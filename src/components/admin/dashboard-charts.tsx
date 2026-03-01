"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts"

interface MonthlyRevenueChartProps {
  data: { month: string; revenue: number }[]
  locale: string
}

const intlLocaleMap: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  zh: "zh-CN",
  ja: "ja-JP",
}

export function MonthlyRevenueChart({ data, locale }: MonthlyRevenueChartProps) {
  const formatRevenue = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return String(value)
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 12 }} width={50} />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat(intlLocaleMap[locale] || "ko-KR").format(Number(value))
          }
        />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface GradeDistributionChartProps {
  data: { grade: string; count: number }[]
}

const GRADE_COLORS: Record<string, string> = {
  BRONZE: "#cd7f32",
  SILVER: "#a8a9ad",
  GOLD: "#ffd700",
  VIP: "#8b5cf6",
}

export function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} width={30} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={GRADE_COLORS[entry.grade] || "#3b82f6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
