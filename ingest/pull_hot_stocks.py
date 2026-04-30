"""拉取港股核心标的快照并写入 SQLite。

数据源优先级：
1. Sina HK quote API（hq.sinajs.cn/list=hk00700,...）— 稳定，需要 Referer
2. 腾讯 HK quote API（qt.gtimg.cn/q=hk00700,...）— 备用

写入 hot_stock_snapshot 表，按当日涨跌幅倒序排名。
"""
from __future__ import annotations

from datetime import datetime
import os
import sys
import time
from typing import Iterable

import requests

from db import connect, init_schema
from hk_universe import HK_UNIVERSE


# 直连，绕过本地代理对 eastmoney/腾讯的奇怪表现
for _k in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
    os.environ.pop(_k, None)

SINA_URL = "https://hq.sinajs.cn/list={codes}"
TENCENT_URL = "https://qt.gtimg.cn/q={codes}"
HEADERS = {
    "Referer": "https://finance.sina.com.cn/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
}


def _chunks(seq: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def fetch_sina(codes: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for batch in _chunks(codes, 50):
        url = SINA_URL.format(codes=",".join(f"hk{c}" for c in batch))
        try:
            r = requests.get(url, headers=HEADERS, timeout=8, proxies={"http": None, "https": None})
            r.encoding = "gbk"
            for line in r.text.splitlines():
                # var hq_str_hk00700="...";
                if "=" not in line or '"' not in line:
                    continue
                key = line.split("=", 1)[0].strip().replace("var hq_str_", "")
                payload = line.split('"', 2)[1]
                fields = payload.split(",")
                if len(fields) < 19:
                    continue
                code = key.replace("hk", "")
                try:
                    out[code] = {
                        "name": fields[1],
                        "open": float(fields[2]) if fields[2] else None,
                        "prev_close": float(fields[3]) if fields[3] else None,
                        "high": float(fields[4]) if fields[4] else None,
                        "low": float(fields[5]) if fields[5] else None,
                        "price": float(fields[6]) if fields[6] else None,
                        "change": float(fields[7]) if fields[7] else None,
                        "pct_change": float(fields[8]) if fields[8] else None,
                        "amount": float(fields[11]) if fields[11] else None,
                        "volume": float(fields[12]) if fields[12] else None,
                        "trade_date": fields[17].replace("/", "-"),
                    }
                except (ValueError, IndexError):
                    pass
        except Exception as e:
            print(f"[sina err] batch {batch[0]}..: {e}", file=sys.stderr)
        time.sleep(0.2)
    return out


def fetch_tencent(codes: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for batch in _chunks(codes, 50):
        url = TENCENT_URL.format(codes=",".join(f"hk{c}" for c in batch))
        try:
            r = requests.get(url, headers=HEADERS, timeout=8, proxies={"http": None, "https": None})
            r.encoding = "gbk"
            for line in r.text.splitlines():
                if "=" not in line or '"' not in line:
                    continue
                key = line.split("=", 1)[0].strip().replace("v_", "")
                payload = line.split('"', 2)[1]
                fields = payload.split("~")
                if len(fields) < 47:
                    continue
                code = key.replace("hk", "")
                try:
                    out[code] = {
                        "name": fields[1],
                        "price": float(fields[3]) if fields[3] else None,
                        "prev_close": float(fields[4]) if fields[4] else None,
                        "open": float(fields[5]) if fields[5] else None,
                        "change": float(fields[31]) if fields[31] else None,
                        "pct_change": float(fields[32]) if fields[32] else None,
                        "amount": float(fields[37]) if fields[37] else None,
                        "trade_date": fields[30].split(" ")[0].replace("/", "-") if len(fields) > 30 else None,
                    }
                except (ValueError, IndexError):
                    pass
        except Exception as e:
            print(f"[tencent err] batch {batch[0]}..: {e}", file=sys.stderr)
        time.sleep(0.2)
    return out


def main() -> int:
    init_schema()
    now = datetime.now()
    ts = now.isoformat(timespec="seconds")
    codes = [c for c, _ in HK_UNIVERSE]

    print(f"[info] fetching {len(codes)} HK stocks via Sina ...", file=sys.stderr)
    data = fetch_sina(codes)
    if len(data) < len(codes) * 0.5:
        print(f"[warn] sina returned only {len(data)}/{len(codes)}, falling back to Tencent", file=sys.stderr)
        data = fetch_tencent(codes)

    if not data:
        print("[err] no data from any source", file=sys.stderr)
        return 1

    # 用接口里的 trade_date，否则用当日
    sample_date = next((v.get("trade_date") for v in data.values() if v.get("trade_date")), None)
    trade_date = sample_date or now.strftime("%Y-%m-%d")

    # 按 |涨跌幅| 排序作为 rank（资金活跃度的代理）
    rows_sorted = sorted(
        data.items(),
        key=lambda kv: abs(kv[1].get("pct_change") or 0),
        reverse=True,
    )

    rows = []
    for rank, (code, d) in enumerate(rows_sorted, 1):
        # 找到中文简称（universe 里的）
        cn_name = next((n for c, n in HK_UNIVERSE if c == code), d.get("name"))
        rows.append((
            trade_date, rank, code, cn_name,
            d.get("price"), d.get("pct_change"), ts,
        ))

    sql = """
    INSERT INTO hot_stock_snapshot (
      trade_date, rank, code, name, price, pct_change, updated_at
    ) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(trade_date, code) DO UPDATE SET
      rank=excluded.rank, name=excluded.name, price=excluded.price,
      pct_change=excluded.pct_change, updated_at=excluded.updated_at
    """
    with connect() as conn:
        conn.executemany(sql, rows)
    print(f"[ok] hot_stocks: {len(rows)} rows on {trade_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
