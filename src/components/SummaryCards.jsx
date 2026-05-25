import React, { useMemo } from 'react'
import { formatKRW } from '../lib/recommend.js'
import {
  totalAnnualCarbon,
  formatCarbon,
  carbonAsCarsEquivalent
} from '../lib/carbon.js'

export default function SummaryCards({ sites, totalEstimatedCost }) {
  const total = sites.length
  const highRisk = sites.filter((s) => s.risk_grade === 'A').length
  const weekInspect = sites.filter(
    (s) => s.risk_grade === 'A' || s.risk_grade === 'B'
  ).length
  const fireLinked = sites.filter((s) => s.risk.fire_risk_score >= 70).length

  const totalCarbon = useMemo(() => totalAnnualCarbon(sites), [sites])
  const carsEquiv = carbonAsCarsEquivalent(totalCarbon)

  const cards = [
    {
      label: '전체 관리 대상',
      value: total + '개',
      tone: 'slate'
    },
    {
      label: '고위험 (A등급)',
      value: highRisk + '개',
      tone: 'red'
    },
    {
      label: '이번 주 점검 권장',
      value: weekInspect + '개',
      tone: 'orange'
    },
    {
      label: '산불위험 연계 구역',
      value: fireLinked + '개',
      tone: 'amber'
    },
    {
      label: '예상 관리 예산',
      value: formatKRW(totalEstimatedCost),
      tone: 'forest',
      small: true
    },
    {
      label: '연간 탄소 흡수량',
      value: formatCarbon(totalCarbon),
      sub: carsEquiv ? `≈ 승용차 ${carsEquiv.toLocaleString()}대/년 배출량` : null,
      tone: 'forest',
      small: true,
      tooltip:
        '면적·길이·수종에 따른 추정값 (출처: 산림청 국립산림과학원 도시숲 탄소흡수량 기준). 보존 시 흡수, 고사·소실 시 동일량 손실.'
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <Card key={c.label} {...c} />
      ))}
    </div>
  )
}

function Card({ label, value, sub, tone, small, tooltip }) {
  const toneClass =
    {
      slate: 'text-slate-900',
      red: 'text-red-600',
      orange: 'text-orange-600',
      amber: 'text-amber-600',
      forest: 'text-forest-700'
    }[tone] || 'text-slate-900'

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      title={tooltip}
    >
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={`mt-1 font-bold ${toneClass} ${
          small ? 'text-sm' : 'text-xl'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
      )}
    </div>
  )
}
