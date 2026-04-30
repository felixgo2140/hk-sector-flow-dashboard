"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type Item = {
  name: string;
  symbol: string;
  rank_1d: number | null;
  rank_5d: number | null;
  pct_1d: number;
  amount_yi: number;
};

export function RotationScatter({
  items,
  height = 460,
  labelTopN = 10,
}: {
  items: Item[];
  height?: number;
  labelTopN?: number;
}) {
  const filtered = items.filter(
    (i) => i.rank_1d != null && i.rank_5d != null,
  );
  const total = filtered.length || 1;
  const labelSet = new Set(
    [...filtered]
      .sort((a, b) => Math.abs(b.pct_1d) - Math.abs(a.pct_1d))
      .slice(0, labelTopN)
      .map((i) => i.name),
  );

  const points = filtered.map((i) => ({
    name: i.name,
    value: [i.rank_5d as number, i.rank_1d as number, i.pct_1d, i.amount_yi],
    showLabel: labelSet.has(i.name),
  }));
  const mid = Math.round(total / 2);

  const option: EChartsOption = {
    grid: { left: 70, right: 30, top: 30, bottom: 50 },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(24, 24, 27, 0.95)",
      borderColor: "#3f3f46",
      textStyle: { color: "#e4e4e7" },
      formatter: (p) => {
        const param = p as { data: { name: string; value: number[] } };
        const [r5, r1, pct, amt] = param.data.value;
        const sign = pct >= 0 ? "+" : "";
        return `<b>${param.data.name}</b><br/>5日排名: ${r5}<br/>1日排名: ${r1}<br/>1日涨跌: ${sign}${pct.toFixed(2)}%<br/>成交: ${amt.toFixed(1)} 亿港元`;
      },
    },
    xAxis: {
      type: "value",
      name: "5日排名（左=强）",
      nameLocation: "middle",
      nameGap: 30,
      inverse: true,
      min: 1,
      max: total,
      axisLabel: { color: "#a1a1aa" },
      splitLine: { lineStyle: { color: "#27272a" } },
      axisLine: { lineStyle: { color: "#3f3f46" } },
    },
    yAxis: {
      type: "value",
      name: "1日排名（下=强）",
      nameLocation: "middle",
      nameGap: 50,
      inverse: true,
      min: 1,
      max: total,
      axisLabel: { color: "#a1a1aa" },
      splitLine: { lineStyle: { color: "#27272a" } },
      axisLine: { lineStyle: { color: "#3f3f46" } },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (val: number[]) =>
          Math.max(8, Math.min(34, Math.sqrt(Math.abs(val[3])) * 1.6)),
        data: points,
        itemStyle: {
          color: (p) => {
            const param = p as { data: { value: number[] } };
            return param.data.value[2] >= 0 ? "#ef4444" : "#10b981";
          },
          opacity: 0.78,
        },
        label: {
          show: true,
          formatter: (p) => {
            const param = p as unknown as {
              name: string;
              data: { showLabel: boolean };
            };
            return param.data.showLabel ? param.name : "";
          },
          position: "top",
          color: "#e4e4e7",
          fontSize: 11,
          fontWeight: 500,
        },
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: "#52525b", type: "dashed" },
          data: [{ xAxis: mid }, { yAxis: mid }],
          label: { color: "#71717a" },
        },
      },
    ],
    backgroundColor: "transparent",
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      theme="dark"
    />
  );
}
