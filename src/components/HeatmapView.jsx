import React, { useMemo } from 'react'
import {
  computeCityFactorMatrix,
  dominantSourcePerFactor,
  FACTOR_KEYS
} from '../lib/cityAggregates.js'
import {
  RISK_FACTOR_LABELS,
  RISK_WEIGHTS,
  SOURCE_LABEL,
  gradeBadgeClass
} from '../lib/risk.js'

function cellStyle(score) {
  // 5단계 색상 그라데이션 (낮음 → 높음)
  if (score >= 80) return { bg: '#dc2626', fg: 'white' }
  if (score >= 60) return { bg: '#ea7a18', fg: 'white' }
  if (score >= 40) return { bg: '#eab308', fg: '#3b2c08' }
  if (score >= 20) return { bg: '#a3d4ad', fg: '#1f3f2b' }
  return { bg: '#e8f3eb', fg: '#264f34' }
}

const FACTOR_SHORT = {
  weather_stress_score: '기상',
  fire_risk_score: '산불',
  vegetation_score: '식생',
  soil_score: '토양',
  management_gap_score: '관리공백',
  damage_history_score: '피해'
}

export default function HeatmapView({ sites, onCityClick, selectedCity }) {
  const matrix = useMemo(() => computeCityFactorMatrix(sites), [sites])
  const dominantSources = useMemo(() => dominantSourcePerFactor(matrix), [matrix])

  if (matrix.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
        필터 조건에 해당하는 사이트가 없습니다.
      </div>
    )
  }

  return (
    <div className="scrollbar-thin flex h-full flex-col overflow-auto bg-white px-5 py-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">
          시군별 6요인 위험도 히트맵
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          충남 {matrix.length}개 시군 · 총 {matrix.reduce((a, c) => a + c.count, 0)}개 사이트 ·
          각 셀은 시군 내 평균 점수. 클릭 시 해당 시군으로 필터링됩니다.
        </div>
      </div>

      <table className="text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium text-slate-500">
              시군
            </th>
            <th className="px-2 py-2 text-right font-medium text-slate-500">
              사이트
            </th>
            {FACTOR_KEYS.map((k) => {
              const src = dominantSources[k]
              const tag = SOURCE_LABEL[src]
              return (
                <th
                  key={k}
                  className="px-2 py-2 text-center align-bottom font-medium text-slate-600"
                  title={RISK_FACTOR_LABELS[k]}
                >
                  <div>{FACTOR_SHORT[k]}</div>
                  <div className="text-[9px] font-normal text-slate-400">
                    × {RISK_WEIGHTS[k]}
                  </div>
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full border px-1 py-px text-[8px] font-semibold ${tag.cls}`}
                  >
                    {tag.label}
                  </span>
                </th>
              )
            })}
            <th className="px-2 py-2 text-center font-medium text-slate-700">
              <div>종합</div>
              <div className="text-[9px] font-normal text-slate-400">위험도</div>
            </th>
            <th className="px-2 py-2 text-center font-medium text-slate-700">
              <div>등급 분포</div>
              <div className="text-[9px] font-normal text-slate-400">A·B·C·D</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => {
            const isSel = selectedCity === row.city
            return (
              <tr
                key={row.city}
                onClick={() => onCityClick?.(row.city)}
                className={`cursor-pointer border-b border-slate-100 transition hover:bg-forest-50 ${
                  isSel ? 'bg-forest-50/70' : ''
                }`}
              >
                <td className="sticky left-0 whitespace-nowrap bg-inherit px-2 py-1.5 font-semibold text-slate-800">
                  {row.city}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                  {row.count}
                </td>
                {FACTOR_KEYS.map((k) => {
                  const v = Math.round(row.factors[k])
                  const st = cellStyle(v)
                  return (
                    <td key={k} className="px-1 py-1">
                      <div
                        className="mx-auto flex h-8 w-12 items-center justify-center rounded-md text-[12px] font-bold tabular-nums"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {v}
                      </div>
                    </td>
                  )
                })}
                <td className="px-1 py-1">
                  <div
                    className="mx-auto flex h-9 w-14 items-center justify-center rounded-md text-sm font-bold tabular-nums"
                    style={(() => {
                      const st = cellStyle(row.total)
                      return { background: st.bg, color: st.fg }
                    })()}
                  >
                    {row.total.toFixed(1)}
                  </div>
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center justify-center gap-1 text-[10px]">
                    <GradeChip grade="A" count={row.grades.A} />
                    <GradeChip grade="B" count={row.grades.B} />
                    <GradeChip grade="C" count={row.grades.C} />
                    <GradeChip grade="D" count={row.grades.D} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
        <span className="font-semibold text-slate-600">색상 범례:</span>
        {[
          ['0~19', '#e8f3eb', '#264f34'],
          ['20~39', '#a3d4ad', '#1f3f2b'],
          ['40~59', '#eab308', '#3b2c08'],
          ['60~79', '#ea7a18', 'white'],
          ['80~100', '#dc2626', 'white']
        ].map(([label, bg, fg]) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="inline-flex h-4 w-7 items-center justify-center rounded text-[9px] font-bold"
              style={{ background: bg, color: fg }}
            >
              {label.split('~')[0]}
            </span>
            <span>{label}</span>
          </span>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">
          ※ 각 셀은 시군 내 사이트들의 해당 요인 평균
        </span>
      </div>
    </div>
  )
}

function GradeChip({ grade, count }) {
  if (count === 0) return <span className="text-slate-300">·</span>
  return (
    <span
      className={`inline-flex h-5 min-w-[24px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${gradeBadgeClass(grade)}`}
      title={`${grade}등급 ${count}개`}
    >
      {grade}
      <span className="ml-0.5 font-medium opacity-80">{count}</span>
    </span>
  )
}
