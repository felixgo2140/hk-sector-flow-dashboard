// 自动生成"信号 banner"和"盘面解读"叙述。
// 输入：今日板块行情 + 南向资金 + HSI 涨跌；输出：1 行诊断 + 1 段叙述 + 三组名单的 hint。
import type { SectorRow } from "./queries";

type Sector = Pick<
  SectorRow,
  "symbol" | "name" | "pct_1d" | "pct_5d" | "pct_20d" | "rank_1d" | "rank_5d" | "amount" | "category"
>;

export type Insights = {
  signal: string;          // 一行诊断，放在顶部 banner
  marketTone: "risk-on" | "risk-off" | "mixed" | "quiet";
  hsiTone: "up" | "down" | "flat";
  southboundTone: "in" | "out" | "flat";
  narrative: string[];     // 盘面解读段落（每个 string 是一段）
  shortLeader: Sector | null;
  midLeader: Sector | null;
  riskWatch: Sector | null;
  emerging: Sector | null;  // 短期落后但中期强势 → 可能转强
  fadingMomentum: Sector | null; // 中期强但短期弱 → 动能衰减
};

function pickStrongShort(sectors: Sector[]): Sector | null {
  const list = sectors.filter((s) => s.pct_1d != null);
  if (!list.length) return null;
  return [...list].sort((a, b) => (b.pct_1d ?? 0) - (a.pct_1d ?? 0))[0];
}
function pickStrongMid(sectors: Sector[]): Sector | null {
  const list = sectors.filter((s) => s.pct_5d != null);
  if (!list.length) return null;
  return [...list].sort((a, b) => (b.pct_5d ?? 0) - (a.pct_5d ?? 0))[0];
}
function pickRisk(sectors: Sector[]): Sector | null {
  const list = sectors.filter((s) => s.pct_1d != null && s.category !== "情绪");
  if (!list.length) return null;
  return [...list].sort((a, b) => (a.pct_1d ?? 0) - (b.pct_1d ?? 0))[0];
}
function pickEmerging(sectors: Sector[]): Sector | null {
  // 5 日强（pct_5d > 中位）但今日落后（pct_1d < 0）→ 调整中可能再起
  const withBoth = sectors.filter(
    (s) => s.pct_1d != null && s.pct_5d != null,
  );
  if (!withBoth.length) return null;
  const med5 =
    [...withBoth].map((s) => s.pct_5d as number).sort((a, b) => a - b)[
      Math.floor(withBoth.length / 2)
    ];
  const cands = withBoth.filter(
    (s) => (s.pct_5d as number) > med5 && (s.pct_1d as number) < 0,
  );
  if (!cands.length) return null;
  return [...cands].sort((a, b) => (b.pct_5d as number) - (a.pct_5d as number))[0];
}
function pickFading(sectors: Sector[]): Sector | null {
  // 5 日强（pct_5d > 0）但今日跌幅靠前 → 动能衰减
  const cands = sectors.filter(
    (s) =>
      s.pct_5d != null &&
      s.pct_1d != null &&
      (s.pct_5d as number) > 0 &&
      (s.pct_1d as number) < -0.5,
  );
  if (!cands.length) return null;
  return [...cands].sort((a, b) => (a.pct_1d as number) - (b.pct_1d as number))[0];
}

function dispersion(sectors: Sector[]): number {
  const xs = sectors
    .map((s) => s.pct_1d)
    .filter((x): x is number => x != null);
  if (xs.length < 2) return 0;
  return Math.max(...xs) - Math.min(...xs);
}

function pctSign(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function computeInsights(
  sectors: Sector[],
  hsiPct: number | null,
  southboundTotal: number, // 当日合计净买额 (亿)
  southboundRecent20Total: number, // 近 20 日累计 (亿)
): Insights {
  const shortLeader = pickStrongShort(sectors);
  const midLeader = pickStrongMid(sectors);
  const riskWatch = pickRisk(sectors);
  const emerging = pickEmerging(sectors);
  const fadingMomentum = pickFading(sectors);
  const disp = dispersion(sectors);

  const hsiTone: Insights["hsiTone"] =
    hsiPct == null
      ? "flat"
      : hsiPct > 0.3
        ? "up"
        : hsiPct < -0.3
          ? "down"
          : "flat";
  const sbTone: Insights["southboundTone"] =
    southboundTotal > 20
      ? "in"
      : southboundTotal < -20
        ? "out"
        : "flat";

  // 大盘基调
  let marketTone: Insights["marketTone"];
  if (disp < 1.0) marketTone = "quiet";
  else if (hsiTone === "up" && sbTone !== "out") marketTone = "risk-on";
  else if (hsiTone === "down" && sbTone === "out") marketTone = "risk-off";
  else marketTone = "mixed";

  // ─── Signal banner（一行）───
  const toneTag: Record<Insights["marketTone"], string> = {
    "risk-on": "风险偏好回升",
    "risk-off": "风险偏好转弱",
    mixed: "结构在分化",
    quiet: "整体平淡",
  };
  const head = toneTag[marketTone];
  const leaderPart = shortLeader
    ? `最强短线锚是 ${shortLeader.symbol} / ${shortLeader.name}`
    : "暂无明显领涨";
  const riskPart = riskWatch
    ? `需要警惕的是 ${riskWatch.symbol} / ${riskWatch.name}`
    : "";
  const signal = riskPart
    ? `${head}。${leaderPart}；${riskPart}。`
    : `${head}。${leaderPart}。`;

  // ─── 盘面解读（叙述段落）───
  const narrative: string[] = [];

  // 第 1 段：大盘 + 南向
  const hsiText =
    hsiPct == null
      ? "恒指无可比数据"
      : `恒指${hsiPct >= 0 ? "上涨" : "下跌"} ${Math.abs(hsiPct).toFixed(2)}%`;
  const sbText =
    sbTone === "in"
      ? `南向资金净买入约 ${southboundTotal.toFixed(0)} 亿港元，内地资金继续接力`
      : sbTone === "out"
        ? `南向资金净流出约 ${Math.abs(southboundTotal).toFixed(0)} 亿港元，内地资金选择减仓`
        : `南向资金近乎平衡（${pctSign(southboundTotal)} 亿）`;
  const recent20Text =
    southboundRecent20Total > 0
      ? `近 20 日累计净买入 ${southboundRecent20Total.toFixed(0)} 亿港元，中期资金面偏多`
      : `近 20 日累计净流出 ${Math.abs(southboundRecent20Total).toFixed(0)} 亿港元，中期资金面偏空`;
  narrative.push(`${hsiText}；${sbText}。${recent20Text}。`);

  // 第 2 段：板块结构
  if (shortLeader) {
    const dispText =
      disp >= 3
        ? "板块离散度处于高位，钱在少数板块里聚集"
        : disp >= 1.5
          ? "板块离散度中等"
          : "板块普涨/普跌为主，结构性机会有限";
    let leaderLine = `今日 ${shortLeader.name} (${shortLeader.symbol}) 1 日 ${pctSign(shortLeader.pct_1d)}、5 日 ${pctSign(shortLeader.pct_5d)}，是当日最强信号`;
    if (
      midLeader &&
      midLeader.symbol !== shortLeader.symbol &&
      (midLeader.pct_5d ?? 0) > (shortLeader.pct_5d ?? 0) + 1
    ) {
      leaderLine += `；中期主线仍是 ${midLeader.name}（5 日 ${pctSign(midLeader.pct_5d)}），短中期出现错位`;
    }
    narrative.push(`${dispText}。${leaderLine}。`);
  }

  // 第 3 段：风险 / 转强 / 衰减
  const tail: string[] = [];
  if (riskWatch && (riskWatch.pct_1d ?? 0) < -0.8) {
    tail.push(
      `${riskWatch.name} 当日 ${pctSign(riskWatch.pct_1d)}，是最弱方向`,
    );
  }
  if (emerging) {
    tail.push(
      `${emerging.name} 中期仍强（5 日 ${pctSign(emerging.pct_5d)}）但今日回调，可能是低吸窗口`,
    );
  }
  if (fadingMomentum && fadingMomentum.symbol !== (riskWatch?.symbol ?? "")) {
    tail.push(
      `${fadingMomentum.name} 5 日仍正但今日 ${pctSign(fadingMomentum.pct_1d)}，动能可能开始衰减`,
    );
  }
  if (tail.length) narrative.push(tail.join("；") + "。");

  return {
    signal,
    marketTone,
    hsiTone,
    southboundTone: sbTone,
    narrative,
    shortLeader,
    midLeader,
    riskWatch,
    emerging,
    fadingMomentum,
  };
}
