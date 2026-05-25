// 충남 공공데이터 ETL
// data/raw/ 폴더의 CSV를 읽어 src/data/sites_real.json 으로 변환한다.
//
// 지원 데이터셋 (컬럼명으로 자동 판별):
//   - 100대 소나무숲   : 시군 / 읍면 / 리 / 산번지 / 면적 / 주요수목
//   - 가로수길표준     : 가로수길명 / 시군구명 / 위도(or X좌표) / 경도(or Y좌표) / 주요수종 / 길이 등
//   - 도시공원표준     : 공원명 / 소재지지번주소 / 위도 / 경도 / 공원유형 / 공원면적 등
//
// 좌표가 없는 경우 시군 중심 좌표 + 작은 jitter 로 근사한다 (시연용).
// 실제 운영에서는 VWorld/Kakao 지오코딩 API 연결 권장.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import { vegetationScoreFromSpecies } from '../src/lib/speciesMatrix.js'

const TODAY = new Date('2026-05-22')

// 외부 API에서 받아온 실데이터 로드 (있으면)
function loadExternal(name) {
  const p = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'external',
    name + '.json'
  )
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    console.warn(`[!] ${name}.json 파싱 실패:`, e.message)
    return null
  }
}

const EXTERNAL = {
  fire_risk: loadExternal('fire_risk_sigungu'),
  weather: loadExternal('weather_sigungu'),
  soil: loadExternal('soil_sigungu'),
  fire_history: loadExternal('fire_history_sigungu')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const RAW_DIR = path.join(ROOT, 'data', 'raw')
const SOURCE_DIR = path.join(ROOT, 'data', 'source-csv')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'sites_real.json')

// 충남 대략 경계 — 원본 CSV에 위경도가 잘못 입력된 사이트(강원·경북 등 범위 밖)는
// 시군 중심으로 자동 보정. lat 35.9~37.05, lng 126.2~127.7
function inChungnamBbox(lat, lng) {
  return (
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= 35.9 &&
    lat <= 37.05 &&
    lng >= 126.2 &&
    lng <= 127.7
  )
}

// 공공데이터포털 제공기관코드 → 충남 시군 매핑 (관리기관명이 비어있는 행 대비)
const AGENCY_CODE_TO_CITY = {
  '4490000': '천안시',
  '4500000': '공주시',
  '4510000': '보령시',
  '4520000': '아산시',
  '4530000': '서산시',
  '4540000': '논산시',
  '4545000': '계룡시',
  '5680000': '당진시',
  '4550000': '금산군',
  '4570000': '부여군',
  '4580000': '서천군',
  '4590000': '청양군',
  '4600000': '홍성군',
  '4610000': '예산군',
  '4620000': '태안군'
}

// 충남 15개 시군 중심 좌표 (시연용 근사값)
const CITY_CENTROIDS = {
  천안시: [36.815, 127.114],
  공주시: [36.447, 127.119],
  보령시: [36.333, 126.612],
  아산시: [36.789, 127.002],
  서산시: [36.785, 126.450],
  논산시: [36.187, 127.099],
  계룡시: [36.275, 127.249],
  당진시: [36.892, 126.629],
  금산군: [36.108, 127.488],
  부여군: [36.275, 126.910],
  서천군: [36.080, 126.692],
  청양군: [36.459, 126.802],
  홍성군: [36.601, 126.660],
  예산군: [36.683, 126.844],
  태안군: [36.745, 126.297]
}

function normalizeCity(raw) {
  if (!raw) return null
  const s = String(raw).replace(/\s+/g, '').trim()
  // "천 안" → "천안시", "천안시" → "천안시"
  for (const key of Object.keys(CITY_CENTROIDS)) {
    const bare = key.replace(/(시|군)$/, '')
    if (s === key || s === bare) return key
    if (s.includes(bare)) return key
  }
  return null
}

function jitter(seed) {
  // 결정론적 작은 좌표 흔들림 (마커가 정확히 겹치지 않도록)
  const x = Math.sin(hash(seed)) * 10000
  return (x - Math.floor(x)) * 0.06 - 0.03 // ±0.03도 (약 ±3km)
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function readCsvAuto(filePath) {
  const buf = fs.readFileSync(filePath)
  // EUC-KR이면 BOM 없이 시작하고 한글이 깨짐. UTF-8 시도 후 실패하면 EUC-KR
  let text = buf.toString('utf8')
  if (text.includes('�') || /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 200))) {
    text = iconv.decode(buf, 'euc-kr')
  }
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true
  })
  return records
}

function pickField(row, candidates) {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim()
  }
  // 공백/구분자 무시한 부분일치
  const norm = (s) => s.replace(/[\s_·.\-()]/g, '').toLowerCase()
  const keys = Object.keys(row)
  for (const c of candidates) {
    const nc = norm(c)
    const k = keys.find((k) => norm(k).includes(nc))
    if (k && row[k] != null && String(row[k]).trim() !== '') {
      return String(row[k]).trim()
    }
  }
  return null
}

function detectSchema(headers) {
  const h = headers.map((x) => x.replace(/\s+/g, ''))
  const has = (k) => h.some((x) => x.includes(k))
  // 소나무숲: 시군 + 읍면 + 리(동) + 번지 + 면적 + 주요(수목|명칭) 조합
  if (
    has('시군') &&
    has('읍면') &&
    (has('번지') || has('산번지')) &&
    (has('주요수목') || has('주요명칭') || has('대상면적'))
  ) {
    return 'pine_forest'
  }
  if (has('가로수') || (has('수종') && (has('시점') || has('종점')))) return 'street_tree'
  if (has('공원명') || has('공원구분')) return 'park'
  return 'unknown'
}

function parseEstablishedYears(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/^(\d{4})/)
  if (!m) return null
  const y = Number(m[1])
  if (y < 1900 || y > 2100) return null
  return TODAY.getFullYear() - y
}

function parsePineForest(row, idx) {
  const cityRaw = pickField(row, ['시군', '시군구', '시군구명'])
  const city = normalizeCity(cityRaw)
  if (!city) return null
  const eupmyeon = pickField(row, ['읍 면', '읍면', '읍면동']) || ''
  const ri = pickField(row, ['리 동', '리동', '리']) || ''
  const lot = pickField(row, ['번 지', '산번지', '번지', '지번']) || ''
  const areaHa = Number(
    pickField(row, [
      '대상면적(헥타르)',
      '대상면적',
      '면적(ha)',
      '면적(헥타)',
      '면적'
    ]) || 0
  )
  const species = pickField(row, ['주요수목', '수종', '주요수종']) || '소나무'
  const remark = pickField(row, ['주요명칭', '명칭', '비고', '기타']) || ''

  const center = CITY_CENTROIDS[city]
  const seedKey = `pf-${city}-${eupmyeon}-${ri}-${lot}-${idx}`
  const lat = center[0] + jitter(seedKey + 'lat')
  const lng = center[1] + jitter(seedKey + 'lng')

  const name = remark
    ? `${remark} (${city} ${eupmyeon}${ri})`
    : `${city} ${eupmyeon} ${ri} 소나무숲`

  return {
    id: `CN-${city.replace(/(시|군)$/, '').toUpperCase()}-PINE-${String(idx).padStart(4, '0')}`,
    name,
    type: 'pine_forest',
    city,
    address: `충청남도 ${city} ${eupmyeon} ${ri} ${lot}`.trim(),
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: areaHa > 0 ? Math.round(areaHa * 10000) : null,
    length_m: null,
    main_species: species,
    managing_agency: `${city} 산림녹지과`,
    source_dataset: '충청남도 아름다운 100대 소나무숲 정보',
    source_url: 'https://www.data.go.kr/data/15032216/fileData.do',
    _coord_approx: true,
    _established_years: null // 소나무숲은 등재일 정보 없음
  }
}

function parseStreetTree(row, idx) {
  const name = pickField(row, ['가로수길명', '가로수길', '도로명', '명칭'])
  const cityRaw = pickField(row, [
    '시군구명',
    '시도시군구명',
    '시군구',
    '관리시군구',
    '관리기관명'
  ])
  let city = normalizeCity(cityRaw) || normalizeCity(pickField(row, ['소재지', '주소']))
  if (!city) {
    const code = pickField(row, ['제공기관코드'])
    if (code && AGENCY_CODE_TO_CITY[code]) city = AGENCY_CODE_TO_CITY[code]
  }
  if (!city || !name) return null

  // 충남 가로수길표준: 시작·종료 좌표가 따로 있으므로 평균(중점) 사용
  const startLat = Number(pickField(row, ['가로수길시작위도']))
  const startLng = Number(pickField(row, ['가로수길시작경도']))
  const endLat = Number(pickField(row, ['가로수길종료위도']))
  const endLng = Number(pickField(row, ['가로수길종료경도']))
  let lat = Number(pickField(row, ['위도', 'Y좌표', 'Y_COORD', 'lat']))
  let lng = Number(pickField(row, ['경도', 'X좌표', 'X_COORD', 'lng', 'lon']))
  let approx = false
  if (isFinite(startLat) && isFinite(startLng) && startLat !== 0 && startLng !== 0) {
    lat = isFinite(endLat) && endLat !== 0 ? (startLat + endLat) / 2 : startLat
    lng = isFinite(endLng) && endLng !== 0 ? (startLng + endLng) / 2 : startLng
  } else if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) {
    const c = CITY_CENTROIDS[city]
    const seedKey = `st-${city}-${name}-${idx}`
    lat = c[0] + jitter(seedKey + 'lat')
    lng = c[1] + jitter(seedKey + 'lng')
    approx = true
  }
  // 좌표가 충남 경계 밖이면 원본 CSV 입력 오류 — 시군 중심으로 보정
  if (!inChungnamBbox(lat, lng)) {
    const c = CITY_CENTROIDS[city]
    if (c) {
      const seedKey = `st-${city}-${name}-${idx}-fix`
      lat = c[0] + jitter(seedKey + 'lat')
      lng = c[1] + jitter(seedKey + 'lng')
      approx = true
    }
  }
  const species = pickField(row, ['가로수종류', '주요수종', '수종']) || '-'
  // 가로수길길이 단위 보정 — 충남 표준데이터는 시군마다 km·m 혼재 입력
  //   100 미만 → km로 가정 (×1000 → m)
  //   100 이상 → 이미 m로 입력된 것으로 가정
  //   결과가 100km(100,000m) 초과면 비정상으로 간주하여 null 처리
  const rawLen = Number(pickField(row, ['가로수길길이']) || 0)
  const lengthM = Number(pickField(row, ['연장(m)', '구간연장']) || 0)
  let length = 0
  if (lengthM > 0) length = lengthM
  else if (rawLen > 0) length = rawLen < 100 ? Math.round(rawLen * 1000) : Math.round(rawLen)
  if (length > 100000) length = 0 // 100km 초과는 비정상
  const agency = pickField(row, ['관리기관명', '관리부서', '담당부서']) || `${city} 산림공원과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  const plantedYears = parseEstablishedYears(pickField(row, ['식재년도']))

  return {
    id: `CN-${city.replace(/(시|군)$/, '').toUpperCase()}-STREET-${String(idx).padStart(4, '0')}`,
    name,
    type: 'street_tree',
    city,
    address: address || `충청남도 ${city}`,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: null,
    length_m: length > 0 ? length : null,
    main_species: species,
    managing_agency: agency,
    source_dataset: '충청남도 가로수길정보표준데이터',
    source_url: 'https://alldam.chungnam.go.kr/',
    _coord_approx: approx,
    _established_years: plantedYears
  }
}

function parsePark(row, idx) {
  const name = pickField(row, ['공원명', '명칭'])
  const cityRaw =
    pickField(row, ['관리시군구', '시군구', '시군구명']) ||
    normalizeCity(pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']))
  const city = normalizeCity(cityRaw)
  if (!city || !name) return null

  let lat = Number(pickField(row, ['위도', 'Y좌표', 'lat']))
  let lng = Number(pickField(row, ['경도', 'X좌표', 'lng']))
  let coordApprox = false
  if (!isFinite(lat) || !isFinite(lng) || lat === 0) {
    const c = CITY_CENTROIDS[city]
    const seedKey = `pk-${city}-${name}-${idx}`
    lat = c[0] + jitter(seedKey + 'lat')
    lng = c[1] + jitter(seedKey + 'lng')
    coordApprox = true
  }
  // 좌표가 충남 경계 밖이면 원본 CSV 입력 오류 — 시군 중심으로 보정
  if (!inChungnamBbox(lat, lng)) {
    const c = CITY_CENTROIDS[city]
    if (c) {
      const seedKey = `pk-${city}-${name}-${idx}-fix`
      lat = c[0] + jitter(seedKey + 'lat')
      lng = c[1] + jitter(seedKey + 'lng')
      coordApprox = true
    }
  }
  const area = Number(pickField(row, ['공원면적', '면적']) || 0)
  const ptype = pickField(row, ['공원구분', '공원유형']) || ''
  const agency = pickField(row, ['관리기관명', '관리부서']) || `${city} 공원녹지과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  const species = pickField(row, ['주요수종', '대표수종']) || '혼효림'
  const establishedYears = parseEstablishedYears(pickField(row, ['지정고시일']))

  return {
    id: `CN-${city.replace(/(시|군)$/, '').toUpperCase()}-PARK-${String(idx).padStart(4, '0')}`,
    name: ptype ? `${name} (${ptype})` : name,
    type: 'park',
    city,
    address: address || `충청남도 ${city}`,
    latitude: round(lat, 6),
    longitude: round(lng, 6),
    area_m2: area > 0 ? area : null,
    length_m: null,
    main_species: species,
    managing_agency: agency,
    source_dataset: '전국도시공원정보표준데이터',
    source_url: 'https://www.data.go.kr/data/15012890/standard.do',
    _coord_approx: coordApprox,
    _established_years: establishedYears
  }
}

function round(n, p) {
  const k = Math.pow(10, p)
  return Math.round(n * k) / k
}

// 시연용 위험요인 시드: 시군/유형/순번 기반으로 결정론적으로 0~100 분포 생성
function seededScore(seed, base) {
  const h = Math.abs(hash(seed))
  return Math.min(100, Math.max(0, base + (h % 30) - 15))
}

// 자산 노후도 → 점수 (조성·식재 후 경과년수 proxy)
// 실 관리이력 데이터 미보유 상태의 추정. 지자체 관리이력 DB 연계 시 정밀화.
function managementGapFromAge(years) {
  if (years == null) return { score: 50, days: null }
  let score
  if (years >= 50) score = 90
  else if (years >= 30) score = 75
  else if (years >= 15) score = 60
  else if (years >= 5) score = 45
  else score = 25
  return { score, days: years * 365 }
}

function fireRiskFromCity(city) {
  if (!EXTERNAL.fire_risk || !EXTERNAL.fire_risk.by_sigun) return null
  const entry = EXTERNAL.fire_risk.by_sigun[city]
  if (!entry) return null
  return {
    score: entry.meanavg,
    analdate: entry.analdate,
    sigun: entry.sigun
  }
}

function weatherStressFromCity(city) {
  if (!EXTERNAL.weather || !EXTERNAL.weather.by_sigun) return null
  const entry = EXTERNAL.weather.by_sigun[city]
  if (!entry || entry.error || entry.score == null) return null
  return {
    score: entry.score,
    maxTemp: entry.maxTemp,
    minHumidity: entry.minHumidity,
    maxWind: entry.maxWind,
    totalRain: entry.totalRain
  }
}

function soilFromCity(city) {
  if (!EXTERNAL.soil || !EXTERNAL.soil.by_sigun) return null
  const entry = EXTERNAL.soil.by_sigun[city]
  if (!entry || entry.found === false || entry.score == null) return null
  return {
    score: entry.score,
    texture_code: entry.texture_code,
    gravel_code: entry.gravel_code,
    slope_code: entry.slope_code,
    pnu: entry.pnu
  }
}

function damageHistoryFromCity(city) {
  if (!EXTERNAL.fire_history || !EXTERNAL.fire_history.by_sigun) return null
  const entry = EXTERNAL.fire_history.by_sigun[city]
  if (!entry || entry.score == null) return null
  return {
    score: entry.score,
    count_yr: entry.count_yr,
    area_ha_yr: entry.area_ha_yr,
    source: entry.source
  }
}

function assignRisk(site) {
  const seed = site.id

  // (1) 식생·수종 취약성: 실데이터 (수종 매트릭스)
  const vegetation_score = vegetationScoreFromSpecies(site.main_species)

  // (2) 관리공백/노후도: 조성·식재 후 경과년수 기반 (proxy)
  const gap = managementGapFromAge(site._established_years)

  // (3) 산불·기상·토양·피해이력: 외부 API/공식 통계 실데이터 (있으면)
  const fire = fireRiskFromCity(site.city)
  const weather = weatherStressFromCity(site.city)
  const soil = soilFromCity(site.city)
  const damage = damageHistoryFromCity(site.city)

  // (4) Fallback - 유형별 시뮬레이션
  const base = {
    pine_forest: { fire: 75, weather: 60, soil: 50, damage: 50 },
    street_tree: { fire: 40, weather: 65, soil: 45, damage: 35 },
    park: { fire: 30, weather: 50, soil: 45, damage: 30 },
    forest_adjacent: { fire: 70, weather: 60, soil: 50, damage: 50 }
  }[site.type] || { fire: 40, weather: 50, soil: 50, damage: 40 }

  return {
    weather_stress_score: weather ? weather.score : seededScore(seed + 'w', base.weather),
    fire_risk_score: fire ? fire.score : seededScore(seed + 'f', base.fire),
    vegetation_score,
    soil_score: soil ? soil.score : seededScore(seed + 's', base.soil),
    management_gap_score: gap.score,
    damage_history_score: damage ? damage.score : seededScore(seed + 'd', base.damage),
    last_management_days: gap.days
  }
}

// 각 위험요인의 데이터 출처 (사이트별로 동적 결정)
function riskSources(site) {
  return {
    weather_stress_score: weatherStressFromCity(site.city) ? 'real' : 'simulation',
    fire_risk_score: fireRiskFromCity(site.city) ? 'real' : 'simulation',
    vegetation_score: 'real',
    soil_score: soilFromCity(site.city) ? 'real' : 'simulation',
    management_gap_score: site._established_years != null ? 'proxy' : 'simulation',
    damage_history_score: damageHistoryFromCity(site.city) ? 'real' : 'simulation'
  }
}

function main() {
  // data/raw/ (사용자 추가용, gitignored) + data/source-csv/ (저장소 커밋, 재현용) 둘 다 스캔
  const sources = []
  for (const dir of [SOURCE_DIR, RAW_DIR]) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (!/\.csv$/i.test(f)) continue
      sources.push({ dir, file: f })
    }
  }
  if (sources.length === 0) {
    console.error(
      `CSV 없음 — data/source-csv 또는 data/raw 폴더에 충남 공공데이터 CSV를 두세요.`
    )
    process.exit(1)
  }
  // 동일 파일명이 양 폴더에 있으면 data/raw (사용자 최신본) 우선
  const seenName = new Set()
  const dedupedSources = []
  // raw 폴더부터 먼저 (사용자 최신 파일 우선권)
  sources.sort((a, b) => (a.dir === RAW_DIR ? -1 : 1))
  for (const s of sources) {
    if (seenName.has(s.file)) continue
    seenName.add(s.file)
    dedupedSources.push(s)
  }
  // 개별 시군 파일이 통합본보다 먼저 처리되도록 정렬
  dedupedSources.sort((a, b) => {
    const aInd = /_(?:시|군)_|시_|군_/.test(a.file) ? 0 : 1
    const bInd = /_(?:시|군)_|시_|군_/.test(b.file) ? 0 : 1
    if (aInd !== bInd) return aInd - bInd
    return b.file.localeCompare(a.file)
  })
  const files = dedupedSources.map((s) => s.file)
  const fileDirMap = new Map(dedupedSources.map((s) => [s.file, s.dir]))

  const out = []
  const seenKey = new Set()
  let counter = 0
  let dedupedCount = 0
  const counts = {}

  for (const file of files) {
    const full = path.join(fileDirMap.get(file) || RAW_DIR, file)
    let rows
    try {
      rows = readCsvAuto(full)
    } catch (e) {
      console.error(`[!] ${file} 파싱 실패: ${e.message}`)
      continue
    }
    if (rows.length === 0) {
      console.warn(`[skip] ${file}: 행 없음`)
      continue
    }
    const schema = detectSchema(Object.keys(rows[0]))
    console.log(`[${schema}] ${file}: ${rows.length}행`)

    const parser =
      schema === 'pine_forest'
        ? parsePineForest
        : schema === 'street_tree'
        ? parseStreetTree
        : schema === 'park'
        ? parsePark
        : null
    if (!parser) {
      console.warn(`  → 스키마 미인식, 건너뜀: ${Object.keys(rows[0]).join(', ')}`)
      continue
    }

    for (const row of rows) {
      counter++
      const site = parser(row, counter)
      if (!site) continue
      // 중복 키: 유형+시군+명칭+좌표(소수 3자리 ≈ 100m 이내)
      const dedupKey = [
        site.type,
        site.city,
        site.name,
        site.latitude.toFixed(3),
        site.longitude.toFixed(3)
      ].join('|')
      if (seenKey.has(dedupKey)) {
        dedupedCount++
        continue
      }
      seenKey.add(dedupKey)
      site.risk = assignRisk(site)
      site.risk_sources = riskSources(site)
      out.push(site)
      counts[schema] = (counts[schema] || 0) + 1
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8')
  console.log(`\n생성: ${OUT_FILE}`)
  console.log(`총 ${out.length}개 사이트:`, counts)
  if (dedupedCount > 0) console.log(`중복 제거: ${dedupedCount}개`)
}

main()
