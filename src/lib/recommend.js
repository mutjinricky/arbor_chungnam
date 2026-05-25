// AI 추천 조치 문장 생성 (규칙 기반). 기획서 10.2 / 15.4 참조.
// 실제 LLM 호출 대신 위험요인 점수 패턴을 보고 추천 문장을 조립한다.

import { ACTION_UNIT_COST } from '../data/sites.js'

const FACTOR_RULES = [
  {
    key: 'management_gap_score',
    threshold: 70,
    actions: ['현장점검', '전정'],
    sentence: (s) =>
      `${s.city} ${s.name}은(는) 최근 관리이력 후 ${s.risk.last_management_days}일이 경과하여 관리공백이 누적된 상태입니다. 보행로 인접 구간을 우선으로 현장점검과 가지 상태 확인이 필요합니다.`
  },
  {
    key: 'fire_risk_score',
    threshold: 75,
    actions: ['현장점검', '제거'],
    sentence: (s) =>
      `${s.city} ${s.name} 일원은 산불위험 지수가 높아 ${s.main_species} 군락의 고사가지·낙엽 제거와 예찰 강화가 우선 필요합니다.`
  },
  {
    key: 'weather_stress_score',
    threshold: 70,
    actions: ['관수', '현장점검'],
    sentence: (s) =>
      `${s.city} ${s.name}은(는) 고온·건조·무강수 조건이 중첩되어 ${s.main_species}의 수세 저하가 우려됩니다. 관수 점검 및 토양 수분 확인이 필요합니다.`
  },
  {
    key: 'vegetation_score',
    threshold: 65,
    actions: ['방제', '현장점검'],
    sentence: (s) =>
      `${s.main_species} 위주의 단순림 구조로 병해충 확산 시 피해 범위가 크므로 ${s.city} ${s.name}에 대한 정기 방제 검토가 권장됩니다.`
  },
  {
    key: 'damage_history_score',
    threshold: 55,
    actions: ['현장점검', '제거'],
    sentence: (s) =>
      `${s.city} ${s.name} 일원은 과거 산불·병해 등 피해 이력이 누적된 지역으로, 고사목·도복 위험목 사전 점검이 필요합니다.`
  },
  {
    key: 'soil_score',
    threshold: 55,
    actions: ['토양개량'],
    sentence: (s) =>
      `${s.city} ${s.name}은(는) 토성·배수 조건이 불리해 ${s.main_species}의 활착이 저하될 수 있어 토양개량 검토가 필요합니다.`
  }
]

export function topFactors(site) {
  const r = site.risk
  return Object.entries(r)
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => b[1] - a[1])
}

export function recommendActions(site) {
  const ranked = topFactors(site)
  const triggered = []

  for (const [factorKey] of ranked) {
    const rule = FACTOR_RULES.find((f) => f.key === factorKey)
    if (!rule) continue
    if (site.risk[factorKey] >= rule.threshold) {
      triggered.push(rule)
    }
    if (triggered.length >= 2) break
  }

  // fallback: 위험요인이 모두 낮으면 정기 관리만 제안
  if (triggered.length === 0) {
    return {
      summary: `${site.city} ${site.name}은(는) 현재 위험요인이 전반적으로 낮으나 ${site.main_species} 정기 관리 사이클 유지가 권장됩니다.`,
      primary: { action: '현장점검', reason: '정기 모니터링' },
      secondary: null,
      estimated_cost_krw: ACTION_UNIT_COST['현장점검']
    }
  }

  const primaryRule = triggered[0]
  const secondaryRule = triggered[1]

  const primaryAction = primaryRule.actions[0]
  const secondaryAction = secondaryRule
    ? secondaryRule.actions[0]
    : primaryRule.actions[1] || null

  const summary =
    primaryRule.sentence(site) +
    (secondaryRule ? ' ' + secondaryRule.sentence(site) : '')

  return {
    summary,
    primary: { action: primaryAction, reason: primaryRule.key },
    secondary: secondaryAction
      ? { action: secondaryAction, reason: secondaryRule?.key || primaryRule.key }
      : null,
    estimated_cost_krw:
      (ACTION_UNIT_COST[primaryAction] || 0) +
      (secondaryAction ? ACTION_UNIT_COST[secondaryAction] || 0 : 0)
  }
}

export function formatKRW(n) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR') + '원'
}
