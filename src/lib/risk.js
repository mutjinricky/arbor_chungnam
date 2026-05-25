// 종합 위험도 = 기상스트레스*0.25 + 산불위험*0.20 + 식생수종*0.15
//             + 토양*0.10 + 관리공백*0.20 + 피해이력*0.10
// 출처: 기획서 9.1 (드라이어드 충남 MVP)
// "민원·피해 이력"은 민원 데이터 접근성 한계로 "피해 이력"(과거 산불·병해 누적)으로 좁힘.

export const RISK_WEIGHTS = {
  weather_stress_score: 0.25,
  fire_risk_score: 0.20,
  vegetation_score: 0.15,
  soil_score: 0.10,
  management_gap_score: 0.20,
  damage_history_score: 0.10
}

export function calcTotalRisk(risk) {
  if (!risk) return 0
  const sum =
    (risk.weather_stress_score || 0) * RISK_WEIGHTS.weather_stress_score +
    (risk.fire_risk_score || 0) * RISK_WEIGHTS.fire_risk_score +
    (risk.vegetation_score || 0) * RISK_WEIGHTS.vegetation_score +
    (risk.soil_score || 0) * RISK_WEIGHTS.soil_score +
    (risk.management_gap_score || 0) * RISK_WEIGHTS.management_gap_score +
    (risk.damage_history_score || 0) * RISK_WEIGHTS.damage_history_score
  return Math.round(sum * 10) / 10
}

export function riskGrade(score) {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

export function gradeMeaning(grade) {
  return {
    A: '즉시 점검 필요',
    B: '단기 점검 권장',
    C: '정기 관리',
    D: '낮은 위험'
  }[grade]
}

export function gradeColor(grade) {
  return {
    A: '#dc2626',
    B: '#ea7a18',
    C: '#eab308',
    D: '#3f7f54'
  }[grade]
}

export function gradeBadgeClass(grade) {
  return {
    A: 'bg-red-100 text-red-700 border border-red-200',
    B: 'bg-orange-100 text-orange-700 border border-orange-200',
    C: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    D: 'bg-forest-100 text-forest-700 border border-forest-200'
  }[grade]
}

export const RISK_FACTOR_LABELS = {
  weather_stress_score: '기상 스트레스',
  fire_risk_score: '산불 위험',
  vegetation_score: '식생·수종 취약성',
  soil_score: '토양·지형',
  management_gap_score: '관리공백 / 노후도',
  damage_history_score: '피해 이력'
}

// 각 요인의 데이터 출처 종류
//   real       : 보유 데이터 또는 매트릭스 (즉시)
//   proxy      : 다른 컬럼으로 추정 (실 관리이력 등 미보유 시 대체)
//   simulation : 외부 API 미연결 상태의 임시 시뮬레이션 (TIER 2 대기)
export const RISK_FACTOR_SOURCE_DEFAULT = {
  weather_stress_score: 'simulation',
  fire_risk_score: 'simulation',
  vegetation_score: 'real',
  soil_score: 'simulation',
  management_gap_score: 'proxy',
  damage_history_score: 'simulation'
}

export const SOURCE_LABEL = {
  real: { label: '실데이터', cls: 'bg-forest-100 text-forest-700 border-forest-200' },
  proxy: { label: '추정', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  simulation: { label: '시뮬레이션', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
}

export function enrichSite(site) {
  const total = calcTotalRisk(site.risk)
  const grade = riskGrade(total)
  return {
    ...site,
    total_risk_score: total,
    risk_grade: grade
  }
}

/**
 * 민원 누적이 위험도에 가산되는 점수 (0~25 cap).
 *   - 건수에 따라 base bonus (5/10/15/20)
 *   - 최근 1년 이내 민원 1건당 +1.5 (cap +5)
 * 6요인 모델은 손대지 않고 사이트별 동적 가산 신호로 사용.
 */
export function complaintBonus(complaints) {
  if (!complaints || complaints.length === 0) return 0
  const n = complaints.length
  const now = new Date()
  const recent = complaints.filter((c) => {
    if (!c.date) return false
    const d = new Date(c.date)
    return !isNaN(d.getTime()) && now - d < 365 * 24 * 60 * 60 * 1000
  }).length

  let bonus
  if (n >= 6) bonus = 20
  else if (n >= 4) bonus = 15
  else if (n >= 2) bonus = 10
  else bonus = 5
  bonus += Math.min(5, recent * 1.5)
  return Math.round(Math.min(25, bonus))
}

/**
 * 사이트의 종합 위험도에 민원 가산점을 적용한 결과를 반환.
 * 원점수는 별도 필드(total_risk_score_base)로 보존.
 */
export function applyComplaintBonus(site, complaints) {
  const bonus = complaintBonus(complaints)
  if (bonus === 0) {
    return { ...site, complaint_count: 0, complaint_bonus: 0 }
  }
  const adjusted = Math.min(100, Math.round((site.total_risk_score + bonus) * 10) / 10)
  return {
    ...site,
    total_risk_score_base: site.total_risk_score,
    total_risk_score: adjusted,
    risk_grade: riskGrade(adjusted),
    risk_grade_base: site.risk_grade,
    complaint_count: complaints.length,
    complaint_bonus: bonus
  }
}
