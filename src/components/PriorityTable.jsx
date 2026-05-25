import React, { useState, useMemo } from 'react'
import { gradeBadgeClass } from '../lib/risk.js'
import { TYPE_LABELS } from '../data/sites.js'
import { recommendActions, formatKRW } from '../lib/recommend.js'

const SORT_OPTIONS = [
  { value: 'risk', label: '위험도 높은 순' },
  { value: 'fire', label: '산불위험 높은 순' },
  { value: 'gap', label: '관리공백 긴 순' },
  { value: 'cost', label: '예상 비용 높은 순' },
  { value: 'complaints', label: '민원 많은 순' }
]

export default function PriorityTable({
  sites,
  selectedId,
  onSelect,
  complaintsBySite = {}
}) {
  const [sort, setSort] = useState('risk')

  const rows = useMemo(() => {
    const withRec = sites.map((s) => {
      const rec = recommendActions(s)
      const complaints = complaintsBySite[s.id] || []
      return { ...s, _rec: rec, _complaints: complaints.length }
    })
    const sorted = withRec.slice()
    sorted.sort((a, b) => {
      if (sort === 'fire')
        return b.risk.fire_risk_score - a.risk.fire_risk_score
      if (sort === 'gap')
        return (b.risk.last_management_days || 0) - (a.risk.last_management_days || 0)
      if (sort === 'cost')
        return b._rec.estimated_cost_krw - a._rec.estimated_cost_krw
      if (sort === 'complaints') return b._complaints - a._complaints
      return b.total_risk_score - a.total_risk_score
    })
    return sorted
  }, [sites, sort, complaintsBySite])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            관리 우선순위
          </div>
          <div className="text-[11px] text-slate-500">
            위험도·산불위험·관리공백·예산을 종합한 정렬 결과
          </div>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-forest-500"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="scrollbar-thin flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <Th className="w-10">순위</Th>
              <Th>대상명</Th>
              <Th>유형</Th>
              <Th>위험도</Th>
              <Th className="text-right">민원</Th>
              <Th>주요 위험</Th>
              <Th>추천 조치</Th>
              <Th className="text-right">예상 비용</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const selected = s.id === selectedId
              const factor = topFactorLabel(s)
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`cursor-pointer border-b border-slate-100 transition hover:bg-forest-50 ${
                    selected ? 'bg-forest-50/70' : ''
                  }`}
                >
                  <Td className="font-semibold text-slate-700">{i + 1}</Td>
                  <Td>
                    <div className="font-medium text-slate-900">{s.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {s.city} · {s.main_species}
                    </div>
                  </Td>
                  <Td>{TYPE_LABELS[s.type]}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${gradeBadgeClass(
                          s.risk_grade
                        )}`}
                      >
                        {s.risk_grade}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {s.total_risk_score}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._complaints > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {s._complaints}
                      </span>
                    ) : (
                      <span className="text-slate-300">·</span>
                    )}
                  </Td>
                  <Td>{factor}</Td>
                  <Td>
                    <span className="text-slate-700">
                      {s._rec.primary.action}
                      {s._rec.secondary
                        ? ' · ' + s._rec.secondary.action
                        : ''}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">
                    {formatKRW(s._rec.estimated_cost_krw)}
                  </Td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  필터 조건에 해당하는 대상지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function topFactorLabel(site) {
  const map = {
    weather_stress_score: '고온·건조',
    fire_risk_score: '산불위험',
    vegetation_score: '수종 취약',
    soil_score: '토양',
    management_gap_score: '노후도',
    damage_history_score: '피해이력'
  }
  const entries = Object.entries(site.risk)
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => b[1] - a[1])
  return entries
    .slice(0, 2)
    .map(([k]) => map[k])
    .filter(Boolean)
    .join(' · ')
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 align-top ${className}`}>
      {children}
    </td>
  )
}
