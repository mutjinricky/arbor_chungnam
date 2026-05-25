// 외부 공공 API에서 위험요인 실데이터를 받아 data/external/*.json 으로 저장한다.
// ETL(scripts/etl.mjs)이 이 JSON들을 읽어 사이트별 위험점수에 주입한다.
//
// 사용:
//   node --env-file=.env scripts/fetchExternal.mjs
//   (DATA_GO_KR_KEY 환경변수 필요)
//
// 현재 지원 API:
//   ✓ 산림청 국립산림과학원 산불위험예보정보 (시군구)
//   △ 기상청 단기예보 (활성화 대기)
//   △ 농진청 토양도 V2 (활성화 대기)
//   △ 산림청 산불발생통계 (활성화 대기)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXT_DIR = path.join(ROOT, 'data', 'external')

const KEY = process.env.DATA_GO_KR_KEY
if (!KEY) {
  console.error('DATA_GO_KR_KEY 미설정. dryad-mvp/.env 에 추가 후 다시 실행.')
  console.error('  실행: node --env-file=.env scripts/fetchExternal.mjs')
  process.exit(1)
}

fs.mkdirSync(EXT_DIR, { recursive: true })

const FETCHERS = [
  { name: 'fire_risk_sigungu', label: '산불위험예보 (시군구)', fn: fetchFireRisk },
  { name: 'weather_sigungu', label: '기상청 단기예보', fn: fetchWeather },
  { name: 'soil_sigungu', label: '농진청 토양도 (시군 대표 PNU)', fn: fetchSoil },
  { name: 'fire_history_sigungu', label: '산불발생통계 (5년)', fn: fetchFireHistoryStub }
]

async function main() {
  for (const f of FETCHERS) {
    process.stdout.write(`[${f.name}] ${f.label} ... `)
    try {
      const result = await f.fn()
      if (result) {
        const out = path.join(EXT_DIR, f.name + '.json')
        fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8')
        console.log('✓', result._summary || 'ok')
      } else {
        console.log('⊘ skipped (활성화 대기)')
      }
    } catch (e) {
      console.log('✗', e.message)
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 1. 산불위험예보 (시군구 단위)
//    응답: doname, sigun, regioncode, meanavg, mini, maxi, d1~d4, analdate
//    meanavg: 0~100 산불위험지수 (51미만=낮음, 51-65=다소높음, 66-85=높음, 86+=매우높음)
// ────────────────────────────────────────────────────────────────
async function fetchFireRisk() {
  const url = new URL(
    'https://apis.data.go.kr/1400377/forestPointV2/forestPointListSigunguSearchV2'
  )
  url.searchParams.set('serviceKey', KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '1000')
  url.searchParams.set('_type', 'json')

  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 100))
  const j = await res.json()
  const items = j?.response?.body?.items?.item || []
  const cn = items.filter((x) => x.doname === '충청남도')
  if (cn.length === 0) throw new Error('충남 데이터 없음')

  const bySigun = {}
  cn.forEach((x) => {
    bySigun[x.sigun] = {
      sigun: x.sigun,
      regioncode: x.regioncode,
      meanavg: x.meanavg,
      mini: x.mini,
      maxi: x.maxi,
      grade_dist: { 낮음: x.d1, 다소높음: x.d2, 높음: x.d3, 매우높음: x.d4 },
      analdate: x.analdate
    }
  })

  return {
    _summary: `충남 ${cn.length}개 시군`,
    fetched_at: new Date().toISOString(),
    source: '산림청_국립산림과학원 산불위험예보정보 V2',
    api_url:
      'https://apis.data.go.kr/1400377/forestPointV2/forestPointListSigunguSearchV2',
    by_sigun: bySigun
  }
}

// ────────────────────────────────────────────────────────────────
// 2. 기상청 단기예보 - 충남 15개 시군 격자
//    응답: category(TMP/TMX/TMN/REH/WSD/PCP/POP), fcstDate, fcstTime, fcstValue
//    향후 48시간 예측에서 최고기온·최저습도·최대풍속·누적강수 추출 → 점수
//    기획서 9.3 기준 (0~90점 척도, 0~100으로 매핑)
// ────────────────────────────────────────────────────────────────

// 충남 15개 시군의 기상청 격자 좌표 (시청·군청 기준)
const KMA_GRIDS = {
  천안시: { nx: 63, ny: 110 },
  공주시: { nx: 60, ny: 103 },
  보령시: { nx: 54, ny: 100 },
  아산시: { nx: 60, ny: 110 },
  서산시: { nx: 51, ny: 110 },
  논산시: { nx: 58, ny: 99 },
  계룡시: { nx: 65, ny: 103 },
  당진시: { nx: 54, ny: 112 },
  금산군: { nx: 69, ny: 100 },
  부여군: { nx: 55, ny: 99 },
  서천군: { nx: 55, ny: 94 },
  청양군: { nx: 57, ny: 103 },
  홍성군: { nx: 55, ny: 106 },
  예산군: { nx: 58, ny: 107 },
  태안군: { nx: 48, ny: 109 }
}

// 발표시각: 02, 05, 08, 11, 14, 17, 20, 23시 (각각 약 10분 후 사용가능)
function latestKmaBaseTime(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - now.getTimezoneOffset() * 60000 * 0)
  // 한국 표준시로 변환은 fetch 환경에 따라 다르므로, UTC 기준 9 더한 시각으로 계산
  const utc = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const h = utc.getUTCHours()
  const m = utc.getUTCMinutes()
  const slots = [2, 5, 8, 11, 14, 17, 20, 23]
  let chosen = 23
  let dateOffset = 0
  for (let i = slots.length - 1; i >= 0; i--) {
    if (h > slots[i] || (h === slots[i] && m >= 15)) {
      chosen = slots[i]
      break
    }
    if (i === 0) {
      // 모두 미달이면 전날 23시
      chosen = 23
      dateOffset = -1
    }
  }
  const d = new Date(utc.getTime() + dateOffset * 86400000)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return {
    base_date: `${y}${mo}${day}`,
    base_time: String(chosen).padStart(2, '0') + '00'
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchKmaForGrid(nx, ny, base, attempt = 1) {
  const url = new URL(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
  )
  url.searchParams.set('serviceKey', KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '1000')
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('base_date', base.base_date)
  url.searchParams.set('base_time', base.base_time)
  url.searchParams.set('nx', String(nx))
  url.searchParams.set('ny', String(ny))
  const res = await fetch(url)
  if (res.status === 429 && attempt < 4) {
    await sleep(2000 * attempt)
    return fetchKmaForGrid(nx, ny, base, attempt + 1)
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const j = await res.json()
  const items = j?.response?.body?.items?.item || []
  return items
}

// 기획서 9.3 기준 기상 스트레스 점수
function calcWeatherStressScore({ maxTemp, minHumidity, maxWind, totalRain }) {
  let score = 0
  // 고온 점수
  if (maxTemp >= 33) score += 25
  else if (maxTemp >= 30) score += 15
  else if (maxTemp >= 27) score += 8
  // 건조 점수
  if (minHumidity != null) {
    if (minHumidity <= 40) score += 20
    else if (minHumidity <= 50) score += 10
  }
  // 강풍 점수
  if (maxWind >= 8) score += 20
  else if (maxWind >= 5) score += 10
  // 무강수 점수 (48시간 누적)
  if (totalRain <= 5) score += 25
  else if (totalRain <= 10) score += 10
  // 0~90 → 0~100 정규화
  return Math.min(100, Math.round((score / 90) * 100))
}

function summarizeWeather(items) {
  let maxTemp = -Infinity
  let minHumidity = Infinity
  let maxWind = -Infinity
  let totalRain = 0
  for (const it of items) {
    const v = parseFloat(it.fcstValue)
    if (!isFinite(v)) {
      // PCP는 "강수없음" 같은 문자열이 옴
      if (it.category === 'PCP' && it.fcstValue === '강수없음') continue
    }
    switch (it.category) {
      case 'TMP':
      case 'TMX':
        if (isFinite(v) && v > maxTemp) maxTemp = v
        break
      case 'REH':
        if (isFinite(v) && v < minHumidity) minHumidity = v
        break
      case 'WSD':
        if (isFinite(v) && v > maxWind) maxWind = v
        break
      case 'PCP':
        if (isFinite(v)) totalRain += v
        break
    }
  }
  if (maxTemp === -Infinity) maxTemp = 20 // fallback
  if (minHumidity === Infinity) minHumidity = 60
  if (maxWind === -Infinity) maxWind = 2
  return { maxTemp, minHumidity, maxWind, totalRain }
}

async function fetchWeather() {
  const base = latestKmaBaseTime()
  const bySigun = {}
  let okCount = 0
  let failCount = 0

  for (const [city, grid] of Object.entries(KMA_GRIDS)) {
    try {
      const items = await fetchKmaForGrid(grid.nx, grid.ny, base)
      const summary = summarizeWeather(items)
      const score = calcWeatherStressScore(summary)
      bySigun[city] = { ...grid, ...summary, score }
      okCount++
    } catch (e) {
      bySigun[city] = { ...grid, error: e.message }
      failCount++
    }
    await sleep(400) // throttle ~2.5 req/s
  }

  if (okCount === 0) throw new Error(`전 시군 실패: ${failCount}개`)

  return {
    _summary: `${okCount}/${Object.keys(KMA_GRIDS).length}개 시군 (${base.base_date} ${base.base_time} 발표 기준)`,
    fetched_at: new Date().toISOString(),
    source: '기상청 단기예보 조회서비스',
    api_url:
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    base_date: base.base_date,
    base_time: base.base_time,
    by_sigun: bySigun
  }
}

// ────────────────────────────────────────────────────────────────
// 3. 농진청 토양도 V2 - 충남 시군별 대표 PNU로 토양 단면 조회
//    응답: XML 전용 (Deepsoil_Qlt_Cd / Deepsoil_Ston_Cd / Soilslope_Cd)
// ────────────────────────────────────────────────────────────────
import { REPRESENTATIVE_PNU } from '../src/data/chungnamPnu.js'

const TEXTURE_SCORE = {
  '01': 70, '02': 40, '03': 35, '04': 20, '05': 25, '06': 60, '99': 50
}
const GRAVEL_SCORE = { '01': 20, '02': 50, '03': 80, '99': 50 }
const SLOPE_SCORE = {
  '01': 20, '02': 25, '03': 40, '04': 60, '05': 80, '06': 95, '99': 50
}

function calcSoilScore({ qlt, ston, slope }) {
  const t = TEXTURE_SCORE[qlt] ?? 50
  const g = GRAVEL_SCORE[ston] ?? 50
  const s = SLOPE_SCORE[slope] ?? 50
  return Math.round(t * 0.4 + g * 0.3 + s * 0.3)
}

function xmlValue(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? m[1].trim() : null
}

async function fetchSoilForPnu(pnu, attempt = 1) {
  const url = new URL(
    'http://apis.data.go.kr/1390802/SoilEnviron/SoilCharacSctnn/V2/getSoilCharacterSctnn'
  )
  url.searchParams.set('serviceKey', KEY)
  url.searchParams.set('PNU_CD', pnu)
  const res = await fetch(url)
  if (res.status === 429 && attempt < 4) {
    await sleep(2000 * attempt)
    return fetchSoilForPnu(pnu, attempt + 1)
  }
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const xml = await res.text()
  const resultCode = xmlValue(xml, 'Result_Code')
  if (resultCode === '301') return { found: false, pnu, resultCode }
  if (resultCode !== '200') {
    throw new Error('Result_Code=' + resultCode + ' ' + (xmlValue(xml, 'Result_Msg') || ''))
  }
  const qlt = xmlValue(xml, 'Deepsoil_Qlt_Cd')
  const ston = xmlValue(xml, 'Deepsoil_Ston_Cd')
  const slope = xmlValue(xml, 'Soilslope_Cd')
  if (!qlt || !ston || !slope) return { found: false, pnu, resultCode }
  return {
    found: true,
    pnu,
    qlt,
    ston,
    slope,
    score: calcSoilScore({ qlt, ston, slope })
  }
}

async function fetchSoilForCity(city, baseEntry) {
  const bjdong = baseEntry.bjdong
  const candidates = [
    baseEntry.pnu,
    `${bjdong}1` + '0010' + '0000',
    `${bjdong}1` + '0100' + '0000',
    `${bjdong}1` + '0500' + '0000',
    `${bjdong}1` + '1000' + '0000',
    `${bjdong}2` + '0001' + '0000'
  ]
  for (const pnu of candidates) {
    try {
      const r = await fetchSoilForPnu(pnu)
      if (r.found) return { ...r, tried_count: candidates.indexOf(pnu) + 1 }
    } catch (e) {
      // 일시 오류면 다음 후보로
    }
    await sleep(200)
  }
  return { found: false, city, candidates_tried: candidates.length }
}

async function fetchSoil() {
  const bySigun = {}
  let okCount = 0
  let noDataCount = 0

  for (const [city, entry] of Object.entries(REPRESENTATIVE_PNU)) {
    const r = await fetchSoilForCity(city, entry)
    if (r.found) {
      bySigun[city] = {
        pnu: r.pnu,
        texture_code: r.qlt,
        gravel_code: r.ston,
        slope_code: r.slope,
        score: r.score,
        tried: r.tried_count
      }
      okCount++
    } else {
      bySigun[city] = { found: false, tried: r.candidates_tried }
      noDataCount++
    }
    await sleep(300)
  }

  if (okCount === 0) throw new Error(`전 시군 데이터 없음 (${noDataCount}건)`)

  return {
    _summary: `${okCount}/${Object.keys(REPRESENTATIVE_PNU).length}개 시군 (대표 PNU 샘플링)`,
    fetched_at: new Date().toISOString(),
    source: '농촌진흥청 토양도 기반 토양특성 단면정보 V2',
    api_url:
      'http://apis.data.go.kr/1390802/SoilEnviron/SoilCharacSctnn/V2/getSoilCharacterSctnn',
    note:
      '시군별 시청·군청 소재 법정동 대표 지번으로 샘플링. 정밀 산출은 VWorld 지오코딩 연계 필요.',
    by_sigun: bySigun
  }
}

// ────────────────────────────────────────────────────────────────
// 4. 산림청 산불발생통계 (스텁)
// ────────────────────────────────────────────────────────────────
async function fetchFireHistoryStub() {
  return null
}

function currentBaseDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

main()
