// 새올행정시스템·국민신문고·안전신문고에서 export한 수목 관련 민원 CSV를
// 사이트에 자동 매칭하는 파서.
//
// 지원 컬럼 (자동 감지, 한글 컬럼명 유연 매칭):
//   필수: 시군 (또는 시군구 / 관리기관)
//   위치: 위도+경도, 또는 주소 (소재지지번주소·소재지도로명주소·주소)
//   메타: 민원ID·접수일자·민원유형·처리상태·내용 등
//
// 매칭 알고리즘:
//   1) 좌표 있고 가장 가까운 사이트가 500m 이내 → 그 사이트에 직접 귀속
//   2) 좌표 없거나 멀면 → 같은 시군의 사이트들에 분산 (시군 단위 집계)

function decodeBuffer(arrayBuffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
  if (utf8.includes('�')) {
    try {
      return new TextDecoder('euc-kr', { fatal: false }).decode(arrayBuffer)
    } catch {
      return utf8
    }
  }
  return utf8
}

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
        } else inQuotes = false
      } else cur += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') {
        row.push(cur)
        cur = ''
      } else if (c === '\r') {
        // skip
      } else if (c === '\n') {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ''
      } else cur += c
    }
  }
  if (cur.length || row.length) {
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
      headers.forEach((h, i) => (o[h] = (r[i] ?? '').trim()))
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
    if (k && row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim()
  }
  return null
}

const CITY_KEYS = ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군']

function normalizeCity(raw) {
  if (!raw) return null
  const s = String(raw).replace(/\s+/g, '')
  for (const k of CITY_KEYS) {
    const bare = k.replace(/(시|군)$/, '')
    if (s.includes(k) || s.includes(bare)) return k
  }
  return null
}

// Haversine distance in meters
function distMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function detectSchema(headers) {
  const h = headers.map((x) => x.replace(/\s+/g, ''))
  const has = (k) => h.some((x) => x.includes(k))
  if (
    (has('민원') || has('신고') || has('접수')) &&
    (has('시군') || has('주소') || has('소재지') || has('관리기관'))
  ) {
    return 'complaint'
  }
  return 'unknown'
}

function parseRow(row, idx) {
  const cityRaw =
    pickField(row, ['시군', '시군구', '시군구명', '관리기관', '관리기관명']) ||
    pickField(row, ['소재지', '주소'])
  const city = normalizeCity(cityRaw)
  if (!city) return null

  const lat = Number(pickField(row, ['위도', 'Y좌표', 'lat']))
  const lng = Number(pickField(row, ['경도', 'X좌표', 'lng', 'lon']))
  const hasCoord =
    isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0

  const date =
    pickField(row, ['접수일자', '접수일', '신고일자', '신고일', '일자', '날짜']) ||
    null
  const type =
    pickField(row, ['민원유형', '신고유형', '유형', '구분', '카테고리']) || '기타'
  const status =
    pickField(row, ['처리상태', '상태', '진행상태']) || '미상'
  const content =
    pickField(row, ['내용', '민원내용', '신고내용', '제목']) || ''
  const id =
    pickField(row, ['민원ID', '민원번호', '신고번호', 'ID', '관리번호']) ||
    `IMP-${Date.now()}-${idx}`
  const address =
    pickField(row, ['소재지지번주소', '소재지도로명주소', '주소']) || ''

  return {
    id,
    city,
    address,
    date,
    type,
    status,
    content,
    latitude: hasCoord ? lat : null,
    longitude: hasCoord ? lng : null
  }
}

/**
 * 민원 1건을 가장 적합한 사이트에 매칭한다.
 *   - 좌표 있고 가장 가까운 사이트가 maxDistM(기본 500m) 이내 → 그 사이트
 *   - 그 외 → null (시군 단위 집계만)
 */
function matchToSite(complaint, sites, maxDistM = 500) {
  if (complaint.latitude == null || complaint.longitude == null) return null
  // 같은 시군 사이트만 후보로 한정 (계산량 + 정확도 양쪽)
  const cands = sites.filter((s) => s.city === complaint.city)
  if (cands.length === 0) return null
  let best = null
  let bestDist = Infinity
  for (const s of cands) {
    if (s.latitude == null || s.longitude == null) continue
    const d = distMeters(
      complaint.latitude,
      complaint.longitude,
      s.latitude,
      s.longitude
    )
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  if (best && bestDist <= maxDistM) {
    return { siteId: best.id, distance_m: Math.round(bestDist) }
  }
  return null
}

/**
 * CSV 파일을 받아 민원 배열로 변환하고, 각 사이트에 매핑한다.
 * @param {File} file
 * @param {Array} sites - 현재 SITES 배열 (좌표 매칭용)
 * @returns {Promise<{complaints, bySite, byCity, total, schema, unmatched}>}
 */
export async function ingestComplaintCsv(file, sites) {
  const buf = await file.arrayBuffer()
  const text = decodeBuffer(buf)
  const rows = parseCsv(text)
  if (rows.length === 0) {
    return { complaints: [], bySite: {}, byCity: {}, total: 0, schema: 'empty' }
  }
  const schema = detectSchema(Object.keys(rows[0]))
  if (schema !== 'complaint') {
    return {
      complaints: [],
      bySite: {},
      byCity: {},
      total: rows.length,
      schema,
      headers: Object.keys(rows[0])
    }
  }

  const complaints = []
  const bySite = {} // { siteId: [complaint, ...] }
  const byCity = {} // { city: [complaint, ...] }
  let unmatched = 0

  rows.forEach((r, i) => {
    const c = parseRow(r, i)
    if (!c) return
    const match = matchToSite(c, sites)
    if (match) {
      c.matched_site_id = match.siteId
      c.matched_distance_m = match.distance_m
      ;(bySite[match.siteId] = bySite[match.siteId] || []).push(c)
    } else {
      c.matched_site_id = null
      unmatched++
    }
    ;(byCity[c.city] = byCity[c.city] || []).push(c)
    complaints.push(c)
  })

  return {
    complaints,
    bySite,
    byCity,
    total: complaints.length,
    schema,
    unmatched
  }
}

/**
 * 사이트에 가산할 민원 점수 (0~100 척도, 위험도 산정에 활용 가능).
 *   - 1건: +15
 *   - 2~3건: +30
 *   - 4~5건: +50
 *   - 6~9건: +70
 *   - 10건+: +90
 * 또한 최근 1년 이내 민원에 가중치 1.5배.
 */
export function complaintImpactScore(complaints) {
  if (!complaints || complaints.length === 0) return 0
  const now = new Date()
  const recent = complaints.filter((c) => {
    if (!c.date) return false
    const d = new Date(c.date)
    if (isNaN(d)) return false
    return (now - d) / (1000 * 60 * 60 * 24) < 365
  }).length
  const effectiveCount = complaints.length + recent * 0.5
  if (effectiveCount >= 10) return 90
  if (effectiveCount >= 6) return 70
  if (effectiveCount >= 4) return 50
  if (effectiveCount >= 2) return 30
  return 15
}
