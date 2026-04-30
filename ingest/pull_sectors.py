"""拉取港股板块（指数代理）日线行情并写入 SQLite。

数据源：sina 港股指数日线 stock_hk_index_daily_sina(symbol)
该接口返回完整历史，第一次跑会比较久，之后只 upsert 增量。
"""
from __future__ import annotations

from datetime import datetime
import sys
import time

import akshare as ak
import pandas as pd

from db import connect, init_schema
from sectors_meta import SECTORS


def upsert_meta() -> None:
    rows = [(s, n, c, d) for s, n, c, d in SECTORS]
    sql = """
    INSERT INTO sector_meta (symbol, name, category, is_default)
    VALUES (?,?,?,?)
    ON CONFLICT(symbol) DO UPDATE SET
      name=excluded.name, category=excluded.category, is_default=excluded.is_default
    """
    with connect() as conn:
        conn.executemany(sql, rows)


def fetch_daily(symbol: str) -> pd.DataFrame:
    df = ak.stock_hk_index_daily_sina(symbol=symbol)
    for c in ["open", "high", "low", "close", "volume", "amount"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    if "date" in df.columns:
        df["date"] = df["date"].astype(str)
    df = df.where(pd.notnull(df), None)
    return df


def upsert_daily(df: pd.DataFrame, symbol: str, ts: str, tail_days: int = 90) -> int:
    if tail_days and len(df) > tail_days:
        df = df.tail(tail_days)
    rows = []
    for _, r in df.iterrows():
        rows.append((
            r.get("date"), symbol,
            r.get("open"), r.get("high"), r.get("low"), r.get("close"),
            r.get("volume"), r.get("amount"), ts,
        ))
    sql = """
    INSERT INTO sector_index_daily (
      trade_date, symbol, open, high, low, close, volume, amount, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(trade_date, symbol) DO UPDATE SET
      open=excluded.open, high=excluded.high, low=excluded.low,
      close=excluded.close, volume=excluded.volume, amount=excluded.amount,
      updated_at=excluded.updated_at
    """
    with connect() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def main() -> int:
    init_schema()
    upsert_meta()
    ts = datetime.now().isoformat(timespec="seconds")
    total = 0
    for symbol, name, _cat, _def in SECTORS:
        try:
            df = fetch_daily(symbol)
            n = upsert_daily(df, symbol, ts)
            print(f"[ok] {symbol} {name}: {n} rows")
            total += n
            time.sleep(0.3)
        except Exception as e:
            print(f"[err] {symbol} {name}: {e}", file=sys.stderr)
    print(f"total upserted: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
