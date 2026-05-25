// 사이트 배열을 시군별로 묶어 6요인 평균 + 종합 위험도 + 등급 분포를 산출한다.
// 히트맵·랭킹 차트 등 시군 단위 시각화의 공통 데이터 소스.

import { RISK_WEIGHTS, riskGrade } from './risk.js'

const FACTOR_KEYS = [
  'weather_stress_score',
  'fire_risk_score',
  'vegetation_score',
  'soil_score',
  'management_gap_score',
  'damage_history_score'
]

export function computeCityFactorMatrix(sites) {
  const cities = {}

  for (const s of sites) {
    if (!s.city || !s.risk) continue
    if (!cities[s.city]) {
      cities[s.city] = {
        city: s.city,
        count: 0,
        factors: Object.fromEntries(FACTOR_KEYS.map((k) => [k, 0])),
        grades: { A: 0, B: 0, C: 0, D: 0 },
        types: { park: 0, street_tree: 0, pine_forest: 0, forest_adjacent: 0 },
        sources: Object.fromEntries(
          FACTOR_KEYS.map((k) => [k, { real: 0, proxy: 0, simulation: 0 }])
        )
      }
    }
    const c = cities[s.city]
    c.count++
    for (const k of FACTOR_KEYS) {
      c.factors[k] += s.risk[k] || 0
      const src = s.risk_sources?.[k] || 'simulation'
      if (c.sources[k][src] != null) c.sources[k][src]++
    }
    if (s.risk_grade && c.grades[s.risk_grade] != null) {
      c.grades[s.risk_grade]++
    }
    if (s.type && c.types[s.type] != null) c.types[s.type]++
  }

  const rows = Object.values(cities)
  for (const c of rows) {
    for (const k of FACTOR_KEYS) {
      c.factors[k] = c.count > 0 ? c.factors[k] / c.count : 0
    }
    let total = 0
    for (const k of FACTOR_KEYS) {
      total += c.factors[k] * (RISK_WEIGHTS[k] || 0)
    }
    c.total = total
    c.total_grade = riskGrade(total)
  }

  rows.sort((a, b) => b.total - a.total)
  return rows
}

// 매트릭스 전체에서 각 요인이 어떤 출처가 다수인지 (헤더에 표시용)
export function dominantSourcePerFactor(matrix) {
  const result = {}
  for (const k of FACTOR_KEYS) {
    const totals = { real: 0, proxy: 0, simulation: 0 }
    for (const row of matrix) {
      totals.real += row.sources[k].real
      totals.proxy += row.sources[k].proxy
      totals.simulation += row.sources[k].simulation
    }
    let max = 'simulation'
    if (totals.real >= totals.proxy && totals.real >= totals.simulation) max = 'real'
    else if (totals.proxy >= totals.simulation) max = 'proxy'
    result[k] = max
  }
  return result
}

export { FACTOR_KEYS }
