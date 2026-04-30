import Link from "next/link";
import { SouthboundChart } from "@/components/SouthboundChart";
import { getSouthboundDaily } from "@/lib/queries";
import { fmtPct, fmtYi, flowColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SouthboundPage() {
  const rows = getSouthboundDaily(240);
  // 合并沪/深
  const map = new Map<
    string,
    {
      date: string;
      hu: number;
      shen: number;
      hsi: number | null;
      hsi_pct: number | null;
      top_stock: string | null;
      top_stock_pct: number | null;
      hold_value: number | null;
    }
  >();
  for (const r of rows) {
    const cur = map.get(r.trade_date) ?? {
      date: r.trade_date,
      hu: 0,
      shen: 0,
      hsi: r.hsi,
      hsi_pct: r.hsi_pct,
      top_stock: r.top_stock,
      top_stock_pct: r.top_stock_pct,
      hold_value: 0,
    };
    if (r.channel === "港股通沪") cur.hu = r.net_buy ?? 0;
    if (r.channel === "港股通深") cur.shen = r.net_buy ?? 0;
    cur.hold_value = (cur.hold_value ?? 0) + (r.hold_value ?? 0);
    cur.hsi = r.hsi ?? cur.hsi;
    cur.hsi_pct = r.hsi_pct ?? cur.hsi_pct;
    cur.top_stock = r.top_stock ?? cur.top_stock;
    cur.top_stock_pct = r.top_stock_pct ?? cur.top_stock_pct;
    map.set(r.trade_date, cur);
  }
  const series = [...map.values()].sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
  const recent = [...series].reverse(); // 最新在前
  const total = series.reduce((s, d) => s + d.hu + d.shen, 0);

  return (
    <div className="flex flex-col gap-5 max-w-[1300px] mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            南向资金 · 历史明细
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            港股通沪 + 港股通深 · 单位：亿港元
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          ← 返回总览
        </Link>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">
            日净买额 · 近 240 个交易日
          </h2>
          <span className="text-[11px] text-zinc-500">
            区间累计 ≈{" "}
            <span
              className={total >= 0 ? "text-red-400" : "text-emerald-400"}
            >
              {fmtYi(total)} 亿
            </span>
          </span>
        </div>
        <div className="p-2">
          <SouthboundChart data={series} height={420} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-2 border-b border-zinc-800">
          <h2 className="text-sm text-zinc-300 font-medium">每日明细</h2>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500 sticky top-0 bg-zinc-900">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-1.5">日期</th>
                <th className="text-right px-3 py-1.5">合计</th>
                <th className="text-right px-3 py-1.5">港股通沪</th>
                <th className="text-right px-3 py-1.5">港股通深</th>
                <th className="text-right px-3 py-1.5">恒指</th>
                <th className="text-right px-3 py-1.5">恒指涨跌</th>
                <th className="text-left px-3 py-1.5">领涨股</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => {
                const total = d.hu + d.shen;
                return (
                  <tr
                    key={d.date}
                    className="border-b border-zinc-900 hover:bg-zinc-900/60"
                  >
                    <td className="px-3 py-1 text-zinc-300 tabular-nums">
                      {d.date}
                    </td>
                    <td
                      className={`px-3 py-1 text-right tabular-nums font-medium ${flowColor(total)}`}
                    >
                      {fmtYi(total)}
                    </td>
                    <td
                      className={`px-3 py-1 text-right tabular-nums ${flowColor(d.hu)}`}
                    >
                      {fmtYi(d.hu)}
                    </td>
                    <td
                      className={`px-3 py-1 text-right tabular-nums ${flowColor(d.shen)}`}
                    >
                      {fmtYi(d.shen)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-zinc-400">
                      {d.hsi != null ? d.hsi.toFixed(0) : "—"}
                    </td>
                    <td
                      className={`px-3 py-1 text-right tabular-nums ${flowColor(d.hsi_pct)}`}
                    >
                      {fmtPct(d.hsi_pct)}
                    </td>
                    <td className="px-3 py-1 text-zinc-300">
                      {d.top_stock || "—"}
                      {d.top_stock_pct != null && (
                        <span
                          className={`ml-1.5 ${flowColor(d.top_stock_pct)} text-[10px]`}
                        >
                          {fmtPct(d.top_stock_pct)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
