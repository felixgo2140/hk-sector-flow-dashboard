// 港股资金以"亿港元"为单位
export function fmtYi(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

// 中国市场色彩约定：上涨红、下跌绿
export function flowColor(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-zinc-400";
  return v > 0 ? "text-red-500" : "text-emerald-500";
}
