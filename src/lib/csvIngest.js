// 브라우저용 CSV 파서.
// 충남 공공데이터 표준 CSV (가로수길/도시공원/소나무숲)를 받아 SITE 객체 배열로 변환한다.
// 인코딩은 UTF-8 또는 EUC-KR 자동 감지. EUC-KR은 TextDecoder('euc-kr')로 처리.

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
  for (const key of Object.keys(CITY_CENTROIDS)) {
    const bare = key.replace(/(시|군)$/, '')
    if (s === key || s === bare) return key
    if (s.includes(bare)) return key
  }
  return null
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
function jitter(seed) {
  const x = Math.sin(hash(seed)) * 10000
  return (x - Math.floor(x)) * 0.06 - 0.03
}

function decodeBuffer(arrayBuffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
  if (utf8.includes('�') || /[\x00-\x08\x0E-\x1F]/.test(utf8.slice(0, 200))) {
    try {
      return new TextDecoder('euc-kr', { fatal: false }).decode(arrayBuffer)
    } catch {
      return utf8
    }
  }
  return utf8
}

// 간단 CSV 파서: 따옴표·이스케이프 지원
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(cur)
        cur = ''
      } else if (c === '\r') {
        // skip
      } else if (c === '\n') {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ''
      } else {
        cur += c
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim().replace(/^﻿/, ''))
  return rows
    .slice(1)
    .filter((r) => r.some((v) => String(v).trim() !== ''))
    .map((r) => {
      const o = {}
      headers.forEach((h, i) => {
        o[h] = (r[i] ?? '').trim()
      })
      return o
    })
}

function pickField(row, candidates) {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim()
  }
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

function round(n, p) {
  const k = Math.pow(10, p)
  return Math.round(n * k) / k
}

function seededScore(seed, base) {
  const h = Math.abs(hash(seed))
  return Math.min(100, Math.max(0, base + (h % 30) - 15))
}

function assignRisk(site) {
  const seed = site.id
  const base =
    {
      pine_forest: { fire: 75, weather: 60, vegetation: 65, soil: 50, gap: 60, damage: 50 },
      street_tree: { fire: 40, weather: 65, vegetation: 55, soil: 45, gap: 55, damage: 35 },
      park: { fire: 30, weather: 50, vegetation: 45, soil: 45, gap: 45, damage: 30 }
    }[site.type] || { fire: 40, weather: 50, vegetation: 50, soil: 50, gap: 50, damage: 40 }
  const gap = seededScore(seed + 'gap', base.gap)
  return {
    weather_stress_score: seededScore(seed + 'w', base.weather),
    fire_risk_score: seededScore(seed + 'f', base.fire),
    vegetation_score: seededScore(seed + 'v', base.vegetation),
    soil_score: seededScore(seed + 's', base.soil),
    management_gap_score: gap,
    damage_history_score: seededScore(seed + 'd', base.damage),
    last_management_days: Math.round(30 + (gap / 100) * 700)
  }
}

function parsePineForest(row, idx) {
  const city = normalizeCity(pickField(row, ['시군', '시군구', '시군구명']))
  if (!city) return null
  const eupmyeon = pickField(row, ['읍 면', '읍면', '읍면동']) || ''
  const ri = pickField(row, ['리 동', '리동', '리']) || ''
  const lot = pickField(row, ['번 지', '산번지', '번지', '지번']) || ''
  const areaHa = Number(pickField(row, ['대상면적(헥타르)', '대상면적', '면적']) || 0)
  const species = pickField(row, ['주요수목', '수종', '주요수종']) || '소나무'
  const remark = pickField(row, ['주요명칭', '명칭', '비고']) || ''
  const c = CITY_CENTROIDS[city]
  const seedKey = `pf-${city}-${eupmyeon}-${ri}-${lot}-${idx}`
  return {
    id: `CN-${city}-PINE-UP-${idx}`,
    name: remark ? `${remark} (${city} ${eupmyeon}${ri})` : `${city} ${eupmyeon} ${ri} 소나무숲`,
    type: 'pine_forest',
    city,
    address: `충청남도 ${city} ${eupmyeon} ${ri} ${lot}`.trim(),
    latitude: round(c[0] + jitter(seedKey + 'lat'), 6),
    longitude: round(c[1] + jitter(seedKey + 'lng'), 6),
    area_m2: areaHa > 0 ? Math.round(areaHa * 10000) : null,
    length_m: null,
    main_species: species,
    managing_agency: `${city} 산림녹지과`,
    source_dataset: '업로드 CSV (소나무숲 표준)',
    source_url: '',
    _coord_approx: true
  }
}

function parseStreetTree(row, idx) {
  const name = pickField(row, ['가로수길명', '가로수길', '도로명', '명칭'])
  const cityRaw = pickField(row, ['시군구명', '시도시군구명', '시군구', '관리시군구', '관리기관명'])
  let city = normalizeCity(cityRaw) || normalizeCity(pickField(row, ['소재지', '주소']))
  if (!city) {
    const code = pickField(row, ['제공기관코드'])
    if (code && AGENCY_CODE_TO_CITY[code]) city = AGENCY_CODE_TO_CITY[code]
  }
  if (!city || !name) return null

  const startLat = Number(pickField(row, ['가로수길시작위도']))
  const startLng = Number(pickField(row, ['가로수길시작경도']))
  const endLat = Number(pickField(row, ['가로수길종료위도']))
  const endLng = Number(pickField(row, ['가로수길종료경도']))
  let lat = Number(pickField(row, ['위도', 'Y좌표', 'lat']))
  let lng = Number(pickField(row, ['경도', 'X좌표', 'lng', 'lon']))
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
  const species = pickField(row, ['가로수종류', '주요수종', '수종']) || '-'
  const lengthKm = Number(pickField(row, ['가로수길길이']) || 0)
  const lengthM = Number(pickField(row, ['연장(m)', '구간연장']) || 0)
  const length = lengthM > 0 ? lengthM : Math.round(lengthKm * 1000)
  const agency = pickField(row, ['관리기관명', '관리부서']) || `${city} 산림공원과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  return {
    id: `CN-${city}-STREET-UP-${idx}`,
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
    source_dataset: '업로드 CSV (가로수길 표준)',
    source_url: '',
    _coord_approx: approx
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
  let approx = false
  if (!isFinite(lat) || !isFinite(lng) || lat === 0) {
    const c = CITY_CENTROIDS[city]
    const seedKey = `pk-${city}-${name}-${idx}`
    lat = c[0] + jitter(seedKey + 'lat')
    lng = c[1] + jitter(seedKey + 'lng')
    approx = true
  }
  const area = Number(pickField(row, ['공원면적', '면적']) || 0)
  const ptype = pickField(row, ['공원구분', '공원유형']) || ''
  const agency = pickField(row, ['관리기관명', '관리부서']) || `${city} 공원녹지과`
  const address = pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''
  const species = pickField(row, ['주요수종', '대표수종']) || '혼효림'
  return {
    id: `CN-${city}-PARK-UP-${idx}`,
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
    source_dataset: '업로드 CSV (도시공원 표준)',
    source_url: '',
    _coord_approx: approx
  }
}

export async function ingestCsvFile(file) {
  const buf = await file.arrayBuffer()
  const text = decodeBuffer(buf)
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { sites: [], schema: 'empty', total: 0, dropped: 0 }
  }
  const schema = detectSchema(Object.keys(rows[0]))
  const parser =
    schema === 'pine_forest'
      ? parsePineForest
      : schema === 'street_tree'
      ? parseStreetTree
      : schema === 'park'
      ? parsePark
      : null

  if (!parser) {
    return {
      sites: [],
      schema,
      total: rows.length,
      dropped: rows.length,
      headers: Object.keys(rows[0])
    }
  }

  const sites = []
  let dropped = 0
  rows.forEach((r, i) => {
    const s = parser(r, Date.now() + i)
    if (!s) {
      dropped++
      return
    }
    s.risk = assignRisk(s)
    s.data_source = 'upload'
    sites.push(s)
  })

  return { sites, schema, total: rows.length, dropped }
}
