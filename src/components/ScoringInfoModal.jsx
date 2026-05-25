import React from 'react'

const FACTORS = [
  {
    key: 'fire_risk_score',
    label: '산불 위험',
    weight: 0.20,
    sourceTier: 'public_only',
    rawSource: {
      label: '산림청 산불위험예보 API',
      url: 'https://www.data.go.kr/data/15084817/openapi.do',
      detail: 'forestPointListSigunguSearchV2 · meanavg (시군별 0~100 표준 지수)'
    },
    refresh: '매일 8회 (3시간 간격)',
    formula: 'score = meanavg (변환 없음)',
    notes: '🟢 100% 산림청 raw 데이터. 자체 가공 없음.'
  },
  {
    key: 'weather_stress_score',
    label: '기상 스트레스',
    weight: 0.25,
    sourceTier: 'public_plan_mvp',
    rawSource: {
      label: '기상청 단기예보 조회서비스',
      url: 'https://www.data.go.kr/data/15084084/openapi.do',
      detail:
        '시군 격자별 향후 48~72h 예보 → 최고기온·최저습도·최대풍속·누적강수'
    },
    refresh: '매일 (가장 최근 발표 시각 기준)',
    formula: [
      'raw =',
      '  (최고기온 ≥33℃ → 25 |  ≥30 → 15 |  ≥27 → 8)',
      '+ (최저습도 ≤40% → 20 |  ≤50 → 10)',
      '+ (최대풍속 ≥8m/s → 20 |  ≥5 → 10)',
      '+ (누적강수 ≤5mm → 25 |  ≤10 → 10)',
      'score = round(raw / 90 × 100)'
    ],
    notes:
      '🟦 임계값(33도/40%/8m/s/5mm)·가산점은 기획서 9.3.  🟧 90→100 정규화는 MVP.'
  },
  {
    key: 'vegetation_score',
    label: '식생·수종 취약성',
    weight: 0.15,
    sourceTier: 'public_mvp',
    rawSource: {
      label: '사이트의 main_species (CSV 원본)',
      url: '',
      detail: '충남 가로수길표준·도시공원표준·100대 소나무숲 데이터셋'
    },
    refresh: '데이터셋 갱신 시',
    formula: [
      '수종 매트릭스 v0.1 (100+ 수종):',
      '  소나무 85, 곰솔 88, 잣나무 70',
      '  은행나무 15, 메타세쿼이아 20, 이팝나무 25',
      '  느티나무 45, 벚나무 60, 단풍나무 40 …',
      '복합 수종: max() (가장 취약한 수종 기준)'
    ],
    notes:
      '🟧 매트릭스는 산림청 산림병해충 발생현황·도시수목관리 일반론 기반 MVP v0.1. 검증된 학술표 아님. 운영 시 산림청·나무의사 자문 v1.0 캘리브레이션 필요.'
  },
  {
    key: 'soil_score',
    label: '토양·지형',
    weight: 0.10,
    sourceTier: 'public_mvp',
    rawSource: {
      label: '농진청 토양도 V2 API',
      url: 'https://www.data.go.kr/data/15144105/openapi.do',
      detail:
        'getSoilCharacterSctnn · 시군 대표 PNU별 (심토토성/자갈/경사 코드)'
    },
    refresh: '분기 1회 (농진청 발표 기준)',
    formula: [
      '토성: 사질 70 / 사양질 40 / 미사사양질 35',
      '       식양질 20 / 미사식양질 25 / 식질 60',
      '자갈: 없음 20 / 있음 50 / 심함 80',
      '경사: 0-2% 20 / 2-7% 25 / 7-15% 40',
      '       15-30% 60 / 30-60% 80 / 60-100% 95',
      'score = 토성×0.4 + 자갈×0.3 + 경사×0.3'
    ],
    notes:
      '🟧 코드→점수 매핑·가중치는 토양학 일반론 기반 MVP. 시군당 PNU 1건 샘플링 (VWorld 지오코딩 연계 시 사이트별 정밀화 가능).'
  },
  {
    key: 'management_gap_score',
    label: '관리공백·노후도',
    weight: 0.20,
    sourceTier: 'public_proxy',
    rawSource: {
      label: 'CSV 지정고시일 / 식재년도',
      url: '',
      detail:
        '도시공원: 지정고시일 (1968~2020) · 가로수길: 식재년도 (1980~2022)'
    },
    refresh: '데이터셋 갱신 시',
    formula: [
      '경과년수 = TODAY − 조성·식재년도',
      '50년+ → 90 · 30~50 → 75 · 15~30 → 60',
      '5~15 → 45 · 5년 미만 → 25 · 미상 → 50'
    ],
    notes:
      '⚠️ 기획서 9.5는 "마지막 관리이력 후 경과" 기준이나 우리는 실 관리이력 미보유로 "조성·식재 후 경과"를 proxy로 사용. 50년 된 공원이 매년 관리되면 실 공백은 적음. 지자체 관리이력 DB 연계 시 정밀화 가능.'
  },
  {
    key: 'damage_history_score',
    label: '피해 이력',
    weight: 0.10,
    sourceTier: 'public_mvp',
    rawSource: {
      label: 'KOSIS 국가통계포털 — 시도별 산불발생 현황',
      url:
        'https://kosis.kr/statHtml/statHtml.do?orgId=136&tblId=DT_136N_010002',
      detail:
        '충남 10년 평균 (2016~2025): 43.0건/년, 284.16 ha/년 — 산림청 산불통계 원천'
    },
    refresh: '연 1회 (KOSIS 갱신 주기)',
    formula: [
      'freq_score = min(100, 건수/100 × 100)   → 43 → 43점',
      'area_score = min(100, 면적/1000 × 100)  → 284.16 → 28.4점',
      'score = freq×0.6 + area×0.4           → 37점'
    ],
    notes:
      '⚠️ KOSIS 시도 단위 통계 → 충남 15개 시군에 동일값 37점. 시군별 차별화 부재. 정밀화는 산림청 통계연보 시군별 분해 후속.  🟧 정규화 기준(100건=100점, 1000ha=100점) MVP.'
  }
]

const TIER_BADGE = {
  public_only: { label: '🟢 100% 공공데이터', cls: 'bg-forest-100 text-forest-800 border-forest-300' },
  public_plan_mvp: { label: '🟢 raw + 🟦 기준 + 🟧 정규화', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  public_mvp: { label: '🟢 raw + 🟧 변환', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  public_proxy: { label: '🟢 raw + 🟧 proxy 해석', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
}

export default function ScoringInfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">
              위험도 산정 산식·출처
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              6요인 raw 데이터 · 변환 산식 · 정직성 분류 (모든 산식 공개)
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-auto px-6 py-4">
          <SectionHeader />

          <ul className="mt-4 space-y-5">
            {FACTORS.map((f) => (
              <FactorCard key={f.key} factor={f} />
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <div className="mb-1 font-semibold text-slate-800">
              정직성 요약
            </div>
            <ul className="list-disc pl-4">
              <li>
                <strong>Raw 입력 데이터</strong>: 공공데이터·공식 통계{' '}
                <strong className="text-forest-700">100%</strong> — 산림청·기상청·농진청·KOSIS·표준데이터셋
              </li>
              <li>
                <strong>가중치·등급 컷오프</strong>: 기획서 9.1·9.2 인용 (외부 근거 없음, 합리적 기본값)
              </li>
              <li>
                <strong>raw → 0~100 점수 변환 산식</strong>: MVP 합리적 기본값 (5개 요인). 운영 시 전문가 자문 캘리브레이션 필요
              </li>
            </ul>
          </div>

          <div className="mt-4 text-[11px] text-slate-500">
            전체 명세서: <code className="rounded bg-slate-100 px-1.5 py-0.5">SCORING.md</code> · 코드: <code className="rounded bg-slate-100 px-1.5 py-0.5">src/lib/risk.js</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5">src/lib/speciesMatrix.js</code>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-800">종합 위험도 산식</div>
      <pre className="mt-1.5 overflow-x-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-700">
{`종합 위험도
= 기상 스트레스   × 0.25
+ 산불 위험       × 0.20
+ 식생·수종      × 0.15
+ 토양·지형      × 0.10
+ 관리공백·노후도 × 0.20
+ 피해 이력      × 0.10

등급: 80+ A · 60+ B · 40+ C · 0+ D    (출처: 기획서 9.1 / 9.2)`}
      </pre>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <Legend tone="forest" label="🟢 PUBLIC 공공데이터" />
        <Legend tone="blue" label="🟦 PLAN 기획서 인용" />
        <Legend tone="amber" label="🟧 MVP 합리적 기본값" />
      </div>
    </div>
  )
}

function Legend({ tone, label }) {
  const cls = {
    forest: 'bg-forest-50 text-forest-700 border-forest-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200'
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function FactorCard({ factor }) {
  const tier = TIER_BADGE[factor.sourceTier]
  const formulaLines = Array.isArray(factor.formula)
    ? factor.formula
    : [factor.formula]

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {factor.label}
            <span className="ml-2 text-[11px] font-normal text-slate-500">
              가중치 × {factor.weight}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {factor.rawSource.url ? (
              <a
                href={factor.rawSource.url}
                target="_blank"
                rel="noreferrer"
                className="text-forest-700 hover:underline"
              >
                {factor.rawSource.label} ↗
              </a>
            ) : (
              <span className="font-medium text-slate-700">
                {factor.rawSource.label}
              </span>
            )}
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-slate-500">{factor.refresh}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {factor.rawSource.detail}
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tier.cls}`}
        >
          {tier.label}
        </span>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          변환 산식
        </div>
        <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
          {formulaLines.join('\n')}
        </pre>
      </div>

      <div className="px-4 py-2.5">
        <div className="text-[11px] leading-relaxed text-slate-600">
          {factor.notes}
        </div>
      </div>
    </li>
  )
}
