import Link from "next/link";
import { SouthboundChart } from "@/components/SouthboundChart";
import { SectorTreemap } from "@/components/SectorTreemap";
import { RotationScatter } from "@/components/RotationScatter";
import { UpdatedAt } from "@/components/UpdatedAt";
import { SignalBanner } from "@/components/SignalBanner";
import {
  getSouthboundDaily,
  getSouthboundLatest,
  getSectorRows,
  getHotStocks,
  getDataStatus,
} from "@/lib/queries";
import { computeInsights } from "@/lib/insights";
import { fmtPct, fmtPrice, fmtYi, flowColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = getDataStatus();
  const sbDaily = getSouthboundDaily(60);
  const sbLatest = getSouthboundLatest();
  const sectors = getSectorRows();
  const hot = getHotStocks(40);

  // ── 南向资金（合并沪+深）
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
  const totalRecent20 = recent20.reduce((s, d) => s + d.hu + d.shen, 0);
  const todayTotal = sbLatest.reduce((s, r) => s + (r.net_buy ?? 0), 0);
  const todayHu = sbLatest.find((r) => r.channel === "港股通沪");
  const todayShen = sbLatest.find((r) => r.channel === "港股通深");
  const tradeDate = sbLatest[0]?.trade_date ?? status.latest ?? "—";
  const updated = sbLatest[0]?.updated_at ?? "";
  const hsi = sbLatest[0]?.hsi;
  const hsiPct = sbLatest[0]?.hsi_pct;

  // 持股市值：akshare 返回单位为元，合计后转亿
  const holdValueYi =
    (sbLatest.reduce((s, r) => s + (r.hold_value ?? 0), 0) || 0) / 1e8;

  // ── 板块衍生指标
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
  const sectorTable = [...sectors].sort(
    (a, b) => (b.pct_1d ?? -999) - (a.pct_1d ?? -999),
  );

  // 三组名单（沿用 insights 给出的洞察作为副标题）
  const leadingShort = [...sectors]
    .filter((s) => s.pct_1d != null)
    .sort((a, b) => (b.pct_1d ?? 0) - (a.pct_1d ?? 0))
    .slice(0, 5);
  const emergingMid = [...sectors]
    .filter((s) => s.pct_5d != null && s.pct_1d != null)
    .sort((a, b) => (b.pct_5d ?? 0) - (a.pct_5d ?? 0))
    .slice(0, 5);
  const lagging = [...sectors]
    .filter((s) => s.pct_1d != null)
    .sort((a, b) => (a.pct_1d ?? 0) - (b.pct_1d ?? 0))
    .slice(0, 5);

  // ── 信号 / 叙述
  const insights = computeInsights(
    sectors,
    hsiPct ?? null,
    todayTotal,
    totalRecent20,
  );

  // 是否盘中（粗判：当日数据更新时间在 30 分钟内 → "盘中"）
  const isLive =
    !!updated && Date.now() - new Date(updated).getTime() < 30 * 60 * 1000;

  const hasData = status.sectors > 0 && status.southbound > 0;

  return (
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto">
      {/* 顶部：标题 + 状态条 */}
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            港股资金流向可视化{" "}
            <span className="text-zinc-500 font-normal">
              · HK Sector Flow
            </span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            港股资金流向，先看南向资金在押注哪个方向。
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>
            交易日{" "}
            <span className="text-zinc-300 font-medium">{tradeDate}</span>
          </span>
          <span>
            状态{" "}
            <span
              className={
                isLive ? "text-emerald-400 font-medium" : "text-zinc-300 font-medium"
              }
            >
              {isLive ? "盘中" : "收盘"}
            </span>
          </span>
          <span>
            覆盖{" "}
            <span className="text-zinc-300 font-medium">
              {sectors.length}
            </span>{" "}
            个板块代理 ·{" "}
            <span className="text-zinc-300 font-medium">
              {status.hot_stocks}
            </span>{" "}
            只标的
          </span>
          <UpdatedAt ts={updated} />
        </div>
      </header>

      {/* 信号 banner */}
      {hasData && <SignalBanner tone={insights.marketTone} text={insights.signal} />}

      {!hasData && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          暂无数据。请在仓库根目录执行{" "}
          <code className="bg-zinc-900 px-1.5 py-0.5 rounded">make pull</code>{" "}
          抓取南向 / 板块 / 个股。
        </div>
      )}

      {/* KPI：恒指 / 南向 / 短期最强 / 中期最强 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="恒指 1D"
          value={hsi != null ? hsi.toFixed(0) : "—"}
          delta={fmtPct(hsiPct)}
          tone={hsiTone(hsiPct)}
          hint="HSI · 收盘"
        />
        <KpiCard
          label="今日南向净买"
          value={`${fmtYi(todayTotal)} 亿`}
          delta={`20日 ${fmtYi(totalRecent20)} 亿`}
          tone={todayTotal >= 0 ? "up" : "down"}
          hint={`沪 ${fmtYi(todayHu?.net_buy)} · 深 ${fmtYi(todayShen?.net_buy)}`}
        />
        <KpiCard
          label="短期最强"
          value={insights.shortLeader?.name ?? "—"}
          delta={fmtPct(insights.shortLeader?.pct_1d)}
          tone={(insights.shortLeader?.pct_1d ?? 0) >= 0 ? "up" : "down"}
          hint={insights.shortLeader?.symbol ?? ""}
        />
        <KpiCard
          label="中期最强"
          value={insights.midLeader?.name ?? "—"}
          delta={`5D ${fmtPct(insights.midLeader?.pct_5d)}`}
          tone={(insights.midLeader?.pct_5d ?? 0) >= 0 ? "up" : "down"}
          hint={insights.midLeader?.symbol ?? ""}
        />
      </section>

      {/* 盘面解读 */}
      {hasData && insights.narrative.length > 0 && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
          <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
            <h2 className="text-sm text-zinc-300 font-medium">
              盘面解读 ·{" "}
              <span className="text-zinc-500">基于今日板块 + 南向资金自动生成</span>
            </h2>
            <span className="text-[11px] text-zinc-500">
              恒指 <span className={flowColor(hsiPct)}>{fmtPct(hsiPct)}</span>
            </span>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm leading-relaxed text-zinc-300">
            {insights.narrative.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* 三组名单 */}
      {hasData && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ListPanel
            title="短期领先（1 日）"
            subtitle="今日资金最青睐的方向"
            accent="text-red-400"
            rows={leadingShort.map((s) => ({
              name: s.name,
              sub: s.symbol,
              value: fmtPct(s.pct_1d),
              tone: "up" as const,
            }))}
          />
          <ListPanel
            title="可能转强（5 日）"
            subtitle="中期主线 · 调整即可能再起"
            accent="text-amber-400"
            rows={emergingMid.map((s) => ({
              name: s.name,
              sub: s.symbol,
              value: fmtPct(s.pct_5d),
              tone: (s.pct_5d ?? 0) >= 0 ? ("up" as const) : ("down" as const),
            }))}
          />
          <ListPanel
            title="需要警惕（1 日）"
            subtitle="今日最弱、警惕进一步杀跌"
            accent="text-emerald-400"
            rows={lagging.map((s) => ({
              name: s.name,
              sub: s.symbol,
              value: fmtPct(s.pct_1d),
              tone: "down" as const,
            }))}
          />
        </section>
      )}

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

      {/* 板块轮动 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            短中期轮动坐标
          </h2>
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
            全量明细 · 按 1 日涨跌排序
          </h2>
          <span className="text-[11px] text-zinc-500">
            持股市值合计 ≈ {fmtYi(holdValueYi)} 亿港元
          </span>
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

      {/* 热门个股 */}
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

function hsiTone(p: number | null | undefined): "up" | "down" | "neutral" {
  if (p == null) return "neutral";
  if (p > 0.1) return "up";
  if (p < -0.1) return "down";
  return "neutral";
}

function KpiCard({
  label,
  value,
  delta,
  tone,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
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
      <div className="text-[11px] text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <div
          className={`text-xl font-semibold tabular-nums truncate ${color}`}
        >
          {value}
        </div>
        {delta && (
          <div className={`text-xs tabular-nums ${color} opacity-90`}>
            {delta}
          </div>
        )}
      </div>
      {hint && (
        <div className="text-[11px] text-zinc-600 mt-0.5 truncate">{hint}</div>
      )}
    </div>
  );
}

function ListPanel({
  title,
  subtitle,
  accent,
  rows,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  rows: { name: string; sub: string; value: string; tone: "up" | "down" }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="px-4 py-2 border-b border-zinc-800">
        <span className={`text-xs font-medium ${accent}`}>{title}</span>
        {subtitle && (
          <div className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</div>
        )}
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
