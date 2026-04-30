"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type Daily = {
  date: string;
  hu: number; // 港股通沪 净买额（亿港元）
  shen: number; // 港股通深 净买额
  hsi_pct: number | null; // 恒生指数当日涨跌幅
};

export function SouthboundChart({
  data,
  height = 360,
}: {
  data: Daily[];
  height?: number;
}) {
  const dates = data.map((d) => d.date);
  const hu = data.map((d) => Number(d.hu.toFixed(2)));
  const shen = data.map((d) => Number(d.shen.toFixed(2)));
  const total = data.map((d) => Number((d.hu + d.shen).toFixed(2)));
  const cum: number[] = [];
  let acc = 0;
  for (const v of total) {
    acc += v;
    cum.push(Number(acc.toFixed(2)));
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(24, 24, 27, 0.95)",
      borderColor: "#3f3f46",
      textStyle: { color: "#e4e4e7" },
      axisPointer: { type: "cross", crossStyle: { color: "#52525b" } },
    },
    legend: {
      data: ["港股通沪", "港股通深", "区间累计"],
      textStyle: { color: "#a1a1aa", fontSize: 11 },
      top: 4,
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: 60, right: 60, top: 36, bottom: 30 },
    xAxis: {
      type: "category",
      data: dates,
      axisLabel: {
        color: "#a1a1aa",
        formatter: (v: string) => v.slice(5),
      },
      axisLine: { lineStyle: { color: "#3f3f46" } },
    },
    yAxis: [
      {
        type: "value",
        name: "日净买额 (亿)",
        nameTextStyle: { color: "#71717a", fontSize: 11 },
        axisLabel: { color: "#a1a1aa" },
        splitLine: { lineStyle: { color: "#27272a" } },
      },
      {
        type: "value",
        name: "累计 (亿)",
        nameTextStyle: { color: "#71717a", fontSize: 11 },
        axisLabel: { color: "#a1a1aa" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "港股通沪",
        type: "bar",
        stack: "net",
        data: hu,
        itemStyle: {
          color: (p) => {
            const v = (p as { value: number }).value;
            return v >= 0 ? "rgba(239, 68, 68, 0.85)" : "rgba(16, 185, 129, 0.85)";
          },
        },
      },
      {
        name: "港股通深",
        type: "bar",
        stack: "net",
        data: shen,
        itemStyle: {
          color: (p) => {
            const v = (p as { value: number }).value;
            return v >= 0 ? "rgba(248, 113, 113, 0.85)" : "rgba(52, 211, 153, 0.85)";
          },
        },
      },
      {
        name: "区间累计",
        type: "line",
        yAxisIndex: 1,
        data: cum,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: "#fbbf24", width: 2 },
        itemStyle: { color: "#fbbf24" },
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
