import { getDb } from "./db";

export type Channel = "港股通沪" | "港股通深";

export type SouthboundRow = {
  trade_date: string;
  channel: Channel;
  net_buy: number | null;
  buy_amount: number | null;
  sell_amount: number | null;
  cum_net_buy: number | null;
  hold_value: number | null;
  top_stock: string | null;
  top_stock_pct: number | null;
  hsi: number | null;
  hsi_pct: number | null;
  updated_at: string;
};

export type SectorRow = {
  symbol: string;
  name: string;
  category: string | null;
  is_default: number;
  trade_date: string;
  close: number;
  amount: number | null;
  // 多周期收益率（百分比，已经是 %，不是小数）
  pct_1d: number | null;
  pct_5d: number | null;
  pct_20d: number | null;
  // 5d / 1d 排名（1 = 最强）
  rank_1d: number | null;
  rank_5d: number | null;
  // 5 日均成交额（亿）
  amount_5d_avg_yi: number | null;
};

export type HotStockRow = {
  trade_date: string;
  rank: number;
  code: string;
  name: string;
  price: number | null;
  pct_change: number | null;
  updated_at: string;
};

// ─────────────────────────────────────────────
// 南向资金
// ─────────────────────────────────────────────

export function getSouthboundDaily(days: number = 60): SouthboundRow[] {
  const db = getDb();
  const sql = `
    SELECT trade_date, channel, net_buy, buy_amount, sell_amount, cum_net_buy,
           hold_value, top_stock, top_stock_pct, hsi, hsi_pct, updated_at
    FROM southbound_flow
    WHERE trade_date >= date(
      (SELECT MAX(trade_date) FROM southbound_flow), '-' || ? || ' days'
    )
    ORDER BY trade_date ASC, channel ASC
  `;
  return db.prepare(sql).all(days) as SouthboundRow[];
}

export function getSouthboundLatest(): SouthboundRow[] {
  const db = getDb();
  const sql = `
    SELECT * FROM southbound_flow
    WHERE trade_date = (SELECT MAX(trade_date) FROM southbound_flow)
  `;
  return db.prepare(sql).all() as SouthboundRow[];
}

// ─────────────────────────────────────────────
// 板块（指数代理）
// ─────────────────────────────────────────────

export function getSectorRows(): SectorRow[] {
  const db = getDb();
  // 取每个 symbol 的最近 30 个交易日，计算 1d/5d/20d 收益率
  const sql = `
    WITH latest AS (
      SELECT symbol, MAX(trade_date) AS d FROM sector_index_daily GROUP BY symbol
    ),
    history AS (
      SELECT s.symbol, s.trade_date, s.close, s.amount,
             ROW_NUMBER() OVER (PARTITION BY s.symbol ORDER BY s.trade_date DESC) AS rn
        FROM sector_index_daily s
        JOIN latest l ON l.symbol = s.symbol
       WHERE s.trade_date >= date(l.d, '-40 days')
    )
    SELECT
      m.symbol, m.name, m.category, m.is_default,
      cur.trade_date, cur.close, cur.amount,
      prev1.close AS close_1d,
      prev5.close AS close_5d,
      prev20.close AS close_20d,
      avg5.avg_amt AS amount_5d_avg
    FROM sector_meta m
    JOIN history cur ON cur.symbol = m.symbol AND cur.rn = 1
    LEFT JOIN history prev1 ON prev1.symbol = m.symbol AND prev1.rn = 2
    LEFT JOIN history prev5 ON prev5.symbol = m.symbol AND prev5.rn = 6
    LEFT JOIN history prev20 ON prev20.symbol = m.symbol AND prev20.rn = 21
    LEFT JOIN (
      SELECT symbol, AVG(amount) AS avg_amt
        FROM history WHERE rn <= 5 GROUP BY symbol
    ) avg5 ON avg5.symbol = m.symbol
    WHERE m.is_default = 1
  `;

  type Raw = {
    symbol: string;
    name: string;
    category: string | null;
    is_default: number;
    trade_date: string;
    close: number;
    amount: number | null;
    close_1d: number | null;
    close_5d: number | null;
    close_20d: number | null;
    amount_5d_avg: number | null;
  };
  const raw = db.prepare(sql).all() as Raw[];

  const rows: SectorRow[] = raw.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    category: r.category,
    is_default: r.is_default,
    trade_date: r.trade_date,
    close: r.close,
    amount: r.amount,
    pct_1d: r.close_1d ? ((r.close - r.close_1d) / r.close_1d) * 100 : null,
    pct_5d: r.close_5d ? ((r.close - r.close_5d) / r.close_5d) * 100 : null,
    pct_20d: r.close_20d ? ((r.close - r.close_20d) / r.close_20d) * 100 : null,
    rank_1d: null,
    rank_5d: null,
    amount_5d_avg_yi: r.amount_5d_avg ? r.amount_5d_avg / 1e8 : null,
  }));

  // 计算 1d / 5d 排名（值越大排名越靠前）
  const ranked1 = [...rows]
    .filter((r) => r.pct_1d != null)
    .sort((a, b) => (b.pct_1d ?? 0) - (a.pct_1d ?? 0));
  ranked1.forEach((r, i) => (r.rank_1d = i + 1));

  const ranked5 = [...rows]
    .filter((r) => r.pct_5d != null)
    .sort((a, b) => (b.pct_5d ?? 0) - (a.pct_5d ?? 0));
  ranked5.forEach((r, i) => (r.rank_5d = i + 1));

  return rows;
}

// ─────────────────────────────────────────────
// 港股热门个股
// ─────────────────────────────────────────────

export function getHotStocks(limit: number = 100): HotStockRow[] {
  const db = getDb();
  const sql = `
    SELECT trade_date, rank, code, name, price, pct_change, updated_at
    FROM hot_stock_snapshot
    WHERE trade_date = (SELECT MAX(trade_date) FROM hot_stock_snapshot)
    ORDER BY pct_change DESC
    LIMIT ?
  `;
  return db.prepare(sql).all(limit) as HotStockRow[];
}

// 数据是否就绪
export function getDataStatus(): {
  southbound: number;
  sectors: number;
  hot_stocks: number;
  latest: string | null;
} {
  const db = getDb();
  const sb = (
    db.prepare("SELECT COUNT(*) AS n FROM southbound_flow").get() as { n: number }
  ).n;
  const sec = (
    db.prepare("SELECT COUNT(*) AS n FROM sector_index_daily").get() as { n: number }
  ).n;
  const hs = (
    db.prepare("SELECT COUNT(*) AS n FROM hot_stock_snapshot").get() as { n: number }
  ).n;
  const latest = (
    db.prepare("SELECT MAX(trade_date) AS d FROM sector_index_daily").get() as {
      d: string | null;
    }
  ).d;
  return { southbound: sb, sectors: sec, hot_stocks: hs, latest };
}
