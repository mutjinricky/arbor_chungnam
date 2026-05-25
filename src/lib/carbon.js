// 사이트별 연간 탄소 흡수량 추정 (tCO2/year)
//
// 출처:
//   - 산림청 국립산림과학원 「도시숲 탄소흡수량 추정 기준」
//   - 침엽수림: 5.4 tCO2/ha/yr
//   - 활엽수림: 7.5 tCO2/ha/yr
//   - 혼효림:   6.5 tCO2/ha/yr
//   - 도시공원(관리됨): 평균 7.5 tCO2/ha/yr
//   - 가로수: 평균 1.4 tCO2/그루/yr (성목 기준), 간격 평균 10m 가정
//
// 한계: 흉고직경·수령·영급 미반영. 운영 시 IR덱의 AGB·BGB·TB 산식
//      (a·(DBH²·H)^b)으로 정밀화 가능 (단목 단위 데이터 확보 후).

const CONIFER_KEYWORDS = [
  '소나무',
  '곰솔',
  '해송',
  '잣나무',
  '리기다',
  '편백',
  '화백',
  '측백',
  '주목',
  '향나무',
  '메타세쿼이아',
  '메타세콰이아',
  '메타쉐쿼이어',
  '메타세콰이어',
  '낙엽송',
  '잎갈나무',
  '대왕송',
  '반송',
  '눈주목'
]
const BROADLEAF_KEYWORDS = [
  '은행',
  '느티',
  '벚',
  '왕벚',
  '이팝',
  '단풍',
  '버즘',
  '플라타너스',
  '플라타나스',
  '버드',
  '능수버들',
  '수양',
  '무궁화',
  '배롱',
  '아카시',
  '아까시',
  '참나무',
  '갈참',
  '신갈',
  '굴참',
  '졸참',
  '떡갈',
  '상수리',
  '느릅',
  '회화',
  '튤립',
  '튜울립',
  '백합나무',
  '오리',
  '자작',
  '팽',
  '대왕참',
  '핀오크',
  '칠엽수',
  '마로니에',
  '미루나무',
  '포플러'
]

function speciesType(mainSpecies) {
  if (!mainSpecies) return 'mixed'
  const first = String(mainSpecies)
    .split(/[+,/]/)[0]
    .trim()
  for (const k of CONIFER_KEYWORDS) {
    if (first.includes(k)) return 'conifer'
  }
  for (const k of BROADLEAF_KEYWORDS) {
    if (first.includes(k)) return 'broadleaf'
  }
  return 'mixed'
}

const ABSORPTION_TCO2_PER_HA = {
  conifer: 5.4,
  broadleaf: 7.5,
  mixed: 6.5
}
const TCO2_PER_STREET_TREE = 1.4 // 성목 기준
const STREET_TREE_SPACING_M = 10 // 가로수 평균 간격

/**
 * 단일 사이트의 연간 탄소 흡수량 추정 (tCO2/yr).
 * 면적 또는 길이 정보가 없으면 0.
 */
export function estimateAnnualCarbon(site) {
  if (!site) return 0
  const type = speciesType(site.main_species)
  if (site.type === 'street_tree') {
    if (!site.length_m || site.length_m <= 0) return 0
    const treeCount = site.length_m / STREET_TREE_SPACING_M
    return treeCount * TCO2_PER_STREET_TREE
  }
  // 도시공원·소나무숲·산림인접지: 면적 기반
  if (!site.area_m2 || site.area_m2 <= 0) return 0
  const ha = site.area_m2 / 10000
  const rate = ABSORPTION_TCO2_PER_HA[type] ?? ABSORPTION_TCO2_PER_HA.mixed
  // 도시공원은 관리 보정 +10%
  const adjustment = site.type === 'park' ? 1.1 : 1.0
  return ha * rate * adjustment
}

/**
 * 사이트 배열 합계 (tCO2/yr).
 */
export function totalAnnualCarbon(sites) {
  return sites.reduce((sum, s) => sum + estimateAnnualCarbon(s), 0)
}

/**
 * 표시용 포맷 (만톤·천톤·톤 자동 단위).
 */
export function formatCarbon(tco2) {
  if (tco2 == null || !isFinite(tco2)) return '-'
  if (tco2 >= 10000) {
    return (tco2 / 10000).toFixed(1) + '만 tCO₂'
  }
  if (tco2 >= 1000) {
    return (tco2 / 1000).toFixed(1) + '천 tCO₂'
  }
  if (tco2 >= 1) {
    return Math.round(tco2).toLocaleString() + ' tCO₂'
  }
  return tco2.toFixed(2) + ' tCO₂'
}

/**
 * 직관적 비유 (자동차 연간 배출량 환산).
 *   승용차 1대 연간 평균 배출량 ≈ 2.4 tCO2 (환경부 기준)
 */
export function carbonAsCarsEquivalent(tco2) {
  if (!tco2 || tco2 <= 0) return null
  return Math.round(tco2 / 2.4)
}
