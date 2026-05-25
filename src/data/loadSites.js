// 시연용 샘플 데이터와 ETL이 생성한 실제 공공데이터(sites_real.json)를 합쳐
// 단일 SITES 배열을 노출한다. 각 사이트에는 data_source 태그가 붙는다.
//   - 'real'   : 충남 공공데이터 ETL 산출물
//   - 'sample' : 시연용 보조 샘플
//
// 새로운 데이터는 src/data/sites_real.json 에 누적되며 ETL 재실행(또는 앱 내
// CSV 업로드)으로 갱신된다.

import { SAMPLE_SITES, INITIAL_RECORDS } from './sites.js'
import REAL_SITES from './sites_real.json'

const tagged = (arr, source) => arr.map((s) => ({ ...s, data_source: source }))

// 실제 데이터를 먼저, 샘플을 뒤에 (동일 ID 충돌 시 실제 우선)
const merged = []
const seen = new Set()
for (const s of tagged(REAL_SITES, 'real')) {
  if (seen.has(s.id)) continue
  seen.add(s.id)
  merged.push(s)
}
for (const s of tagged(SAMPLE_SITES, 'sample')) {
  if (seen.has(s.id)) continue
  seen.add(s.id)
  merged.push(s)
}

export const SITES = merged
export { INITIAL_RECORDS }
export const REAL_COUNT = REAL_SITES.length
export const SAMPLE_COUNT = SAMPLE_SITES.length

export {
  TYPE_LABELS,
  ACTION_TYPES,
  ACTION_UNIT_COST
} from './sites.js'
