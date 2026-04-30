-- 南向资金（港股通沪 / 港股通深）每日流向
CREATE TABLE IF NOT EXISTS southbound_flow (
  trade_date     TEXT NOT NULL,           -- YYYY-MM-DD
  channel        TEXT NOT NULL,           -- 港股通沪 | 港股通深
  net_buy        REAL,                    -- 当日成交净买额（亿港元）
  buy_amount     REAL,                    -- 买入成交额
  sell_amount    REAL,                    -- 卖出成交额
  cum_net_buy    REAL,                    -- 历史累计净买额
  fund_inflow    REAL,                    -- 当日资金流入
  fund_balance   REAL,                    -- 当日余额
  hold_value     REAL,                    -- 持股市值
  top_stock      TEXT,                    -- 领涨股
  top_stock_pct  REAL,                    -- 领涨股涨跌幅
  hsi            REAL,                    -- 恒生指数收盘
  hsi_pct        REAL,                    -- 恒生指数涨跌幅
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (trade_date, channel)
);
CREATE INDEX IF NOT EXISTS idx_southbound_flow_date ON southbound_flow(trade_date);

-- 港股指数 / 板块（指数代理）每日行情
CREATE TABLE IF NOT EXISTS sector_index_daily (
  trade_date  TEXT NOT NULL,              -- YYYY-MM-DD
  symbol      TEXT NOT NULL,              -- 例：HSTECH / HSMPI / CSHKLC
  open        REAL,
  high        REAL,
  low         REAL,
  close       REAL NOT NULL,
  volume      REAL,
  amount      REAL,                       -- 成交额（港元）
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (trade_date, symbol)
);
CREATE INDEX IF NOT EXISTS idx_sector_index_daily_symbol ON sector_index_daily(symbol, trade_date);

-- 港股板块（指数）元数据
CREATE TABLE IF NOT EXISTS sector_meta (
  symbol      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,              -- 中文名
  category    TEXT,                       -- 行业 / 主题 / 大盘
  is_default  INTEGER DEFAULT 0           -- 是否默认在看板展示
);

-- 港股热门个股资金流（每日快照）
CREATE TABLE IF NOT EXISTS hot_stock_snapshot (
  trade_date  TEXT NOT NULL,              -- YYYY-MM-DD
  rank        INTEGER NOT NULL,           -- 当前排名
  code        TEXT NOT NULL,              -- 股票代码（如 00700）
  name        TEXT NOT NULL,
  price       REAL,
  pct_change  REAL,                       -- 涨跌幅 %
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (trade_date, code)
);
CREATE INDEX IF NOT EXISTS idx_hot_stock_date ON hot_stock_snapshot(trade_date, rank);
