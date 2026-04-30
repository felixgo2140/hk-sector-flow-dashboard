import Link from "next/link";
import { getHotStocks } from "@/lib/queries";
import { fmtPct, fmtPrice, flowColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const all = getHotStocks(200);
  const up = all.filter((r) => (r.pct_change ?? 0) > 0);
  const down = all.filter((r) => (r.pct_change ?? 0) < 0);

  return (
    <div className="flex flex-col gap-5 max-w-[1300px] mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            港股核心标的 · 资金活跃榜
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            恒生指数 + 恒生科技 + 恒生中国企业 + 港股通常见名股 ·{" "}
            {all.length} 只
          </p>
        </div>
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200">
          ← 返回总览
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StockTable title="上涨" rows={up} accent="text-red-400" />
        <StockTable title="下跌" rows={down} accent="text-emerald-400" />
      </section>
    </div>
  );
}

function StockTable({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: ReturnType<typeof getHotStocks>;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
        <h2 className={`text-sm font-medium ${accent}`}>
          {title} <span className="text-zinc-500">({rows.length})</span>
        </h2>
      </div>
      <div className="overflow-y-auto max-h-[760px]">
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
            {rows.map((r, i) => (
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
    </div>
  );
}
