"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type Item = {
  symbol: string;
  name: string;
  pct_1d: number | null;
  pct_5d: number | null;
  amount_yi: number; // 亿港元，treemap 块大小
};

export function SectorTreemap({
  items,
  height = 480,
}: {
  items: Item[];
  height?: number;
}) {
  const data = items
    .filter((i) => i.amount_yi > 0)
    .map((i) => ({
      name: i.name,
      symbol: i.symbol,
      value: i.amount_yi,
      pct_1d: i.pct_1d ?? 0,
      pct_5d: i.pct_5d ?? 0,
    }));

  // 用 1 日涨跌幅着色（中国惯例：红涨绿跌）
  const colorOf = (pct: number) => {
    const t = Math.max(-3, Math.min(3, pct)) / 3;
    if (t > 0) {
      const a = Math.min(1, 0.25 + t * 0.7);
      return `rgba(239, 68, 68, ${a})`;
    }
    if (t < 0) {
      const a = Math.min(1, 0.25 + -t * 0.7);
      return `rgba(16, 185, 129, ${a})`;
    }
    return "rgba(82, 82, 91, 0.4)";
  };

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: "rgba(24, 24, 27, 0.95)",
      borderColor: "#3f3f46",
      textStyle: { color: "#e4e4e7" },
      formatter: (info) => {
        const d = (info as unknown as { data: typeof data[number] }).data;
        const sign1 = d.pct_1d >= 0 ? "+" : "";
        const sign5 = d.pct_5d >= 0 ? "+" : "";
        return `<b>${d.name}</b> <span style="color:#71717a">${d.symbol}</span><br/>
          1日涨跌: <b>${sign1}${d.pct_1d.toFixed(2)}%</b><br/>
          5日涨跌: ${sign5}${d.pct_5d.toFixed(2)}%<br/>
          成交额: ${d.value.toFixed(1)} 亿港元`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          symbol: d.symbol,
          pct_1d: d.pct_1d,
          pct_5d: d.pct_5d,
          itemStyle: {
            color: colorOf(d.pct_1d),
            borderColor: "#18181b",
            borderWidth: 1,
            gapWidth: 1,
          },
        })),
        label: {
          show: true,
          formatter: (info) => {
            const d = (info as unknown as { data: typeof data[number] }).data;
            const sign = d.pct_1d >= 0 ? "+" : "";
            return `{name|${d.name}}\n{val|${sign}${d.pct_1d.toFixed(2)}%}`;
          },
          rich: {
            name: {
              fontSize: 13,
              fontWeight: 600,
              color: "#fafafa",
              lineHeight: 18,
            },
            val: {
              fontSize: 11,
              color: "#fafafa",
              opacity: 0.9,
              lineHeight: 14,
            },
          },
          overflow: "truncate",
        },
        upperLabel: { show: false },
        levels: [{ itemStyle: { borderWidth: 0, gapWidth: 1 } }],
        emphasis: {
          itemStyle: { borderColor: "#fafafa", borderWidth: 2 },
          label: { show: true },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      theme="dark"
      notMerge
    />
  );
}
