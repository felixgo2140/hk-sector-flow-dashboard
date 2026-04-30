import Link from "next/link";
import { SouthboundChart } from "@/components/SouthboundChart";
import { SectorTreemap } from "@/components/SectorTreemap";
import { RotationScatter } from "@/components/RotationScatter";
import { UpdatedAt } from "@/components/UpdatedAt";
import {
  getSouthboundDaily,
  getSouthboundLatest,
  getSectorRows,
  getHotStocks,
  getDataStatus,
} from "@/lib/queries";
import { fmtPct, fmtPrice, fmtYi, flowColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = getDataStatus();
  const sbDaily = getSouthboundDaily(60);
  const sbLatest = getSouthboundLatest();
  const sectors = getSectorRows();
  const hot = getHotStocks(40);

  // 把南向数据按日期合并（沪 + 深）
  const sbMap = new Map<
    string,
    { date: string; hu: number; shen: number; hsi_pct: number | null }
  >();
  for (const r of sbDaily) {
    const cur = sbMap.get(r.trade_date) ?? {
      date: r.trade_date,
      hu: 0,
      shen: 0,
      hsi_pct: r.hsi_pct,
    };
    if (r.channel === "港股通沪") cur.hu = r.net_buy ?? 0;
    if (r.channel === "港股通深") cur.shen = r.net_buy ?? 0;
    cur.hsi_pct = r.hsi_pct;
    sbMap.set(r.trade_date, cur);
  }
  const sbSeries = [...sbMap.values()].sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const recent20 = sbSeries.slice(-20);
  const totalRecent = recent20.reduce((s, d) => s + d.hu + d.shen, 0);
  const todayTotal = sbLatest.reduce((s, r) => s + (r.net_buy ?? 0), 0);
  const todayHu = sbLatest.find((r) => r.channel === "港股通沪");
  const todayShen = sbLatest.find((r) => r.channel === "港股通深");
  const tradeDate = sbLatest[0]?.trade_date ?? status.latest ?? "—";
  const updated = sbLatest[0]?.updated_at ?? "";
  const hsi = sbLatest[0]?.hsi;
  const hsiPct = sbLatest[0]?.hsi_pct;

  // 板块 treemap & rotation
  const treemapItems = sectors
    .filter((s) => s.amount && s.amount > 0)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      pct_1d: s.pct_1d,
      pct_5d: s.pct_5d,
      amount_yi: (s.amount ?? 0) / 1e8,
    }));

  const rotationItems = sectors.map((s) => ({
    name: s.name,
    symbol: s.symbol,
    rank_1d: s.rank_1d,
    rank_5d: s.rank_5d,
    pct_1d: s.pct_1d ?? 0,
    amount_yi: (s.amount ?? 0) / 1e8,
  }));

  // 板块表 - 按 1日涨幅降序
  const sectorTable = [...sectors].sort(
    (a, b) => (b.pct_1d ?? -999) - (a.pct_1d ?? -999),
  );

  // 三组名单
  const leadingShort = [...sectors]
    .filter((s) => s.pct_1d != null)
    .sort((a, b) => (b.pct_1d ?? 0) - (a.pct_1d ?? 0))
    .slice(0, 5);
  const leadingMid = [...sectors]
    .filter((s) => s.pct_5d != null)
    .sort((a, b) => (b.pct_5d ?? 0) - (a.pct_5d ?? 0))
    .slice(0, 5);
  const lagging = [...sectors]
    .filter((s) => s.pct_1d != null)
    .sort((a, b) => (a.pct_1d ?? 0) - (b.pct_1d ?? 0))
    .slice(0, 5);

  const hasData = status.sectors > 0 && status.southbound > 0;

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* 顶部：当日要点 */}
      <header className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            港股资金流向看板
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            南向资金 · 板块代理指数 · 热门个股 · 板块轮动
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
          <span>
            交易日{" "}
            <span className="text-zinc-300 font-medium">{tradeDate}</span>
          </span>
          {hsi != null && (
            <span>
              恒指{" "}
              <span className="text-zinc-300 font-medium">
                {hsi.toFixed(0)}
              </span>{" "}
              <span className={flowColor(hsiPct)}>{fmtPct(hsiPct)}</span>
            </span>
          )}
          <UpdatedAt ts={updated} />
        </div>
      </header>

      {!hasData && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          暂无数据。请先在仓库根目录跑{" "}
          <code className="bg-zinc-900 px-1.5 py-0.5 rounded">make pull</code>{" "}
          抓取南向 / 板块 / 个股。
        </div>
      )}

      {/* 当日 KPI 卡片 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="今日南向净买"
          value={`${fmtYi(todayTotal)} 亿`}
          tone={todayTotal >= 0 ? "up" : "down"}
          hint={`沪 ${fmtYi(todayHu?.net_buy)} · 深 ${fmtYi(todayShen?.net_buy)}`}
        />
        <KpiCard
          label="近 20 日累计"
          value={`${fmtYi(totalRecent)} 亿`}
          tone={totalRecent >= 0 ? "up" : "down"}
          hint="港股通沪 + 港股通深"
        />
        <KpiCard
          label="持股市值"
          value={`${fmtYi(
            (sbLatest.reduce((s, r) => s + (r.hold_value ?? 0), 0) || 0) / 1,
          )} 亿`}
          tone="neutral"
          hint="陆股通南向累计持仓"
        />
        <KpiCard
          label="覆盖板块 / 个股"
          value={`${status.sectors > 0 ? sectors.length : 0} / ${status.hot_stocks}`}
          tone="neutral"
          hint="指数代理 / 核心标的"
        />
      </section>

      {/* 南向资金趋势 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            南向资金 ·{" "}
            <span className="text-zinc-500">近 60 个交易日 · 单位亿港元</span>
          </h2>
          <Link
            href="/southbound"
            className="text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            完整历史 →
          </Link>
        </div>
        <div className="p-2">
          <SouthboundChart data={sbSeries} height={320} />
        </div>
      </section>

      {/* 板块热力图 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            港股板块热力图 ·{" "}
            <span className="text-zinc-500">指数代理 · 1 日涨跌着色</span>
          </h2>
          <span className="text-[11px] text-zinc-500">
            块大小 = 当日成交额 ·{" "}
            <span className="text-red-400">红=上涨</span> /{" "}
            <span className="text-emerald-400">绿=下跌</span>
          </span>
        </div>
        <div className="p-2">
          <SectorTreemap items={treemapItems} height={460} />
        </div>
      </section>

      {/* 三组名单 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ListPanel
          title="短期领涨（1 日）"
          accent="text-red-400"
          rows={leadingShort.map((s) => ({
            name: s.name,
            sub: s.symbol,
            value: fmtPct(s.pct_1d),
            tone: "up" as const,
          }))}
        />
        <ListPanel
          title="中期强势（5 日）"
          accent="text-amber-400"
          rows={leadingMid.map((s) => ({
            name: s.name,
            sub: s.symbol,
            value: fmtPct(s.pct_5d),
            tone: "up" as const,
          }))}
        />
        <ListPanel
          title="风险板块（1 日）"
          accent="text-emerald-400"
          rows={lagging.map((s) => ({
            name: s.name,
            sub: s.symbol,
            value: fmtPct(s.pct_1d),
            tone: "down" as const,
          }))}
        />
      </section>

      {/* 板块轮动散点 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">板块轮动坐标</h2>
          <span className="text-[11px] text-zinc-500">
            横:5日排名 / 纵:1日排名 ·{" "}
            <span className="text-red-400">右下=持续强势</span> · 左下=新晋强势
            · <span className="text-emerald-400">左上=持续弱势</span> ·
            右上=动能衰减
          </span>
        </div>
        <div className="p-2">
          <RotationScatter items={rotationItems} height={420} labelTopN={10} />
        </div>
      </section>

      {/* 板块全量明细 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            板块明细 · 按 1 日涨跌排序
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500 sticky top-0 bg-zinc-900">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-1.5 w-10">#</th>
                <th className="text-left px-3 py-1.5">板块</th>
                <th className="text-left px-3 py-1.5 text-zinc-600">代码</th>
                <th className="text-right px-3 py-1.5">收盘</th>
                <th className="text-right px-3 py-1.5">1D</th>
                <th className="text-right px-3 py-1.5">5D</th>
                <th className="text-right px-3 py-1.5">20D</th>
                <th className="text-right px-3 py-1.5">成交额(亿)</th>
                <th className="text-right px-3 py-1.5">5日均(亿)</th>
              </tr>
            </thead>
            <tbody>
              {sectorTable.map((r, i) => (
                <tr
                  key={r.symbol}
                  className="border-b border-zinc-900 hover:bg-zinc-900/60"
                >
                  <td className="px-3 py-1 text-zinc-500 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1 text-zinc-200">{r.name}</td>
                  <td className="px-3 py-1 text-zinc-500 font-mono text-[11px]">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-300">
                    {r.close.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums font-medium ${flowColor(r.pct_1d)}`}
                  >
                    {fmtPct(r.pct_1d)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums ${flowColor(r.pct_5d)}`}
                  >
                    {fmtPct(r.pct_5d)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums ${flowColor(r.pct_20d)}`}
                  >
                    {fmtPct(r.pct_20d)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-300">
                    {fmtYi((r.amount ?? 0) / 1e8)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-500">
                    {fmtYi(r.amount_5d_avg_yi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 热门个股 Top */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            港股热门个股 · 按 1 日涨跌排序
          </h2>
          <Link
            href="/stocks"
            className="text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            全部 →
          </Link>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500 sticky top-0 bg-zinc-900">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-1.5 w-10">#</th>
                <th className="text-left px-3 py-1.5 text-zinc-600">代码</th>
                <th className="text-left px-3 py-1.5">名称</th>
                <th className="text-right px-3 py-1.5">现价</th>
                <th className="text-right px-3 py-1.5">涨跌幅</th>
              </tr>
            </thead>
            <tbody>
              {hot.map((r, i) => (
                <tr
                  key={r.code}
                  className="border-b border-zinc-900 hover:bg-zinc-900/60"
                >
                  <td className="px-3 py-1 text-zinc-500 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1 text-zinc-500 font-mono text-[11px]">
                    {r.code}
                  </td>
                  <td className="px-3 py-1 text-zinc-200">{r.name}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-zinc-300">
                    {fmtPrice(r.price)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums font-medium ${flowColor(r.pct_change)}`}
                  >
                    {fmtPct(r.pct_change)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  hint?: string;
}) {
  const color =
    tone === "up"
      ? "text-red-400"
      : tone === "down"
        ? "text-emerald-400"
        : "text-zinc-200";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${color}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{hint}</div>
      )}
    </div>
  );
}

function ListPanel({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: { name: string; sub: string; value: string; tone: "up" | "down" }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="px-4 py-2 border-b border-zinc-800">
        <span className={`text-xs font-medium ${accent}`}>{title}</span>
      </div>
      <ul className="divide-y divide-zinc-900">
        {rows.length === 0 && (
          <li className="px-4 py-3 text-xs text-zinc-500">—</li>
        )}
        {rows.map((r) => (
          <li
            key={r.sub}
            className="px-4 py-2 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-200 truncate">{r.name}</span>
              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                {r.sub}
              </span>
            </div>
            <span
              className={`tabular-nums font-medium ${
                r.tone === "up" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
