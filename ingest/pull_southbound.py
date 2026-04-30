"""拉取南向资金（港股通沪 / 港股通深）每日历史并写入 SQLite。"""
from __future__ import annotations

from datetime import datetime
import sys

import akshare as ak
import pandas as pd

from db import connect, init_schema

CHANNELS = ["港股通沪", "港股通深"]


def fetch(channel: str) -> pd.DataFrame:
    df = ak.stock_hsgt_hist_em(symbol=channel)
    numeric = [
        "当日成交净买额", "买入成交额", "卖出成交额", "历史累计净买额",
        "当日资金流入", "当日余额", "持股市值",
        "领涨股-涨跌幅", "恒生指数", "恒生指数-涨跌幅",
    ]
    for c in numeric:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.where(pd.notnull(df), None)
    return df


def upsert(df: pd.DataFrame, channel: str, ts: str) -> int:
    rows = []
    for _, r in df.iterrows():
        rows.append((
            r.get("日期"),
            channel,
            r.get("当日成交净买额"),
            r.get("买入成交额"),
            r.get("卖出成交额"),
            r.get("历史累计净买额"),
            r.get("当日资金流入"),
            r.get("当日余额"),
            r.get("持股市值"),
            r.get("领涨股"),
            r.get("领涨股-涨跌幅"),
            r.get("恒生指数"),
            r.get("恒生指数-涨跌幅"),
            ts,
        ))
    sql = """
    INSERT INTO southbound_flow (
      trade_date, channel, net_buy, buy_amount, sell_amount, cum_net_buy,
      fund_inflow, fund_balance, hold_value, top_stock, top_stock_pct,
      hsi, hsi_pct, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(trade_date, channel) DO UPDATE SET
      net_buy=excluded.net_buy,
      buy_amount=excluded.buy_amount,
      sell_amount=excluded.sell_amount,
      cum_net_buy=excluded.cum_net_buy,
      fund_inflow=excluded.fund_inflow,
      fund_balance=excluded.fund_balance,
      hold_value=excluded.hold_value,
      top_stock=excluded.top_stock,
      top_stock_pct=excluded.top_stock_pct,
      hsi=excluded.hsi,
      hsi_pct=excluded.hsi_pct,
      updated_at=excluded.updated_at
    """
    with connect() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def main() -> int:
    init_schema()
    ts = datetime.now().isoformat(timespec="seconds")
    total = 0
    for ch in CHANNELS:
        try:
            df = fetch(ch)
            n = upsert(df, ch, ts)
            print(f"[ok] {ch}: {n} rows")
            total += n
        except Exception as e:
            print(f"[err] {ch}: {e}", file=sys.stderr)
    print(f"total upserted: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
