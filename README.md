# HK Sector Flow Dashboard

港股资金流向看板 —— 参考 [US Sector Flow Dashboard](https://us-sector-flow-dashboard.vercel.app/) 的形式，
展示南向资金（港股通）、港股板块（指数代理）、板块轮动散点、热门个股 4 个维度。

## 技术栈

- 数据源：AKShare 南向资金接口 + Sina 港股指数 / 报价 API
- 抓数：Python（`ingest/`）写入 SQLite（`db/data.db`）
- 前端：Next.js 16 (App Router) + better-sqlite3 + ECharts + Tailwind 4

## 数据范围

| 维度          | 来源                                                       | 频率      |
| ------------- | ---------------------------------------------------------- | --------- |
| 南向资金日表  | `akshare.stock_hsgt_hist_em(港股通沪/深)`                  | 日线，全历史 |
| 板块代理指数  | `akshare.stock_hk_index_daily_sina(symbol)` × 15 个指数    | 日线，最近 90 天 |
| 港股核心标的  | `https://hq.sinajs.cn/list=hk00700,...`（fallback：腾讯）   | 当日快照  |

板块代理指数挑选了 HSI / HSCEI / HSTECH 三大基准 + HSMBI/HSMPI/HSMOGI/HSCCI 四个恒生综合行业 +
CSHKLC/CSHKLRE/CSHKSE/CSHKPE/CSHKDIV/CSHK100/CESG10 七个中证香港主题，共 15 只。

> ⚠️ 港股不像 A 股有"主力净流入"披露，这里以**指数收益率 + 成交额**作为板块资金流的代理，
> 与美股看板用 ETF 行情做代理同思路。

## 使用

```bash
make install          # 装 Python 依赖
make pull             # 抓全部数据 (南向 + 板块 + 个股)
cd web && npm install # 装前端依赖
make dev              # 启动 http://localhost:3000
```

每日定时刷新建议：

```bash
# crontab 例 — 港股收盘后 17:00 拉一次
0 17 * * 1-5 cd /path/to/hk-sector-flow-dashboard && make pull
```

## 目录

```
hk-sector-flow-dashboard/
├── db/                    # SQLite 库文件 + schema
├── ingest/                # Python 抓数
│   ├── pull_southbound.py # 南向资金日历史
│   ├── pull_sectors.py    # 板块代理指数日线
│   ├── pull_hot_stocks.py # 港股核心标的快照（Sina/腾讯）
│   ├── hk_universe.py     # ~80 只港股代码列表
│   └── sectors_meta.py    # 15 只板块代理指数元数据
└── web/                   # Next.js 前端
    ├── app/               # 总览 / southbound / stocks 三个页面
    ├── components/        # SectorTreemap / RotationScatter / SouthboundChart 等
    └── lib/               # db.ts (better-sqlite3) + queries.ts + format.ts
```
