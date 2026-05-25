// 시연용 샘플 사이트와 임의 관리이력은 제거됨 (모든 사이트는 sites_real.json의 공공데이터로 운용).
// 이 파일은 UI 라벨·액션 카탈로그만 유지한다.

export const SAMPLE_SITES = []
export const INITIAL_RECORDS = {}

export const TYPE_LABELS = {
  park: '도시공원',
  street_tree: '가로수길',
  pine_forest: '소나무숲',
  forest_adjacent: '산림인접지'
}

export const ACTION_TYPES = [
  '전정',
  '방제',
  '관수',
  '토양개량',
  '제거',
  '보식',
  '현장점검'
]

export const ACTION_UNIT_COST = {
  전정: 2500000,
  방제: 3500000,
  관수: 1200000,
  토양개량: 4500000,
  제거: 6000000,
  보식: 5500000,
  현장점검: 500000
}
