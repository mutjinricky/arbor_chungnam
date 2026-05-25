import React from 'react'
import { TYPE_LABELS } from '../data/sites.js'

export default function Header({
  cities,
  filters,
  setFilters,
  totalCount,
  shownCount,
  onOpenCsv,
  onOpenComplaint,
  onOpenScoring,
  onOpenFreshness,
  freshnessLabel,
  realCount = 0,
  sampleCount = 0,
  uploadedCount = 0,
  complaintCount = 0
}) {
  function update(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest-600 text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2 L4 10 H8 L4 16 H9 L5 22 H19 L15 16 H20 L16 10 H20 Z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">
              DRYAD 충남 AI 수목관리 대시보드
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>충남 공공데이터 기반 의사결정 지원 MVP</span>
              <span className="mx-1 text-slate-300">|</span>
              <SourcePill tone="forest" label={`실제 ${realCount}`} title="ETL이 충남 공공데이터에서 가져온 사이트" />
              {sampleCount > 0 && (
                <SourcePill tone="slate" label={`샘플 ${sampleCount}`} title="시연용 보조 샘플" />
              )}
              {uploadedCount > 0 && (
                <SourcePill tone="amber" label={`업로드 ${uploadedCount}`} title="이번 세션에서 CSV 업로드" />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={filters.query || ''}
            onChange={(v) => update('query', v)}
          />
          <FilterSelect
            label="시군구"
            value={filters.city}
            onChange={(v) => update('city', v)}
            options={[{ value: 'ALL', label: '전체 시군구' }].concat(
              cities.map((c) => ({ value: c, label: c }))
            )}
          />
          <FilterSelect
            label="유형"
            value={filters.type}
            onChange={(v) => update('type', v)}
            options={[
              { value: 'ALL', label: '전체 유형' },
              ...Object.entries(TYPE_LABELS).map(([v, l]) => ({
                value: v,
                label: l
              }))
            ]}
          />
          <FilterSelect
            label="위험등급"
            value={filters.grade}
            onChange={(v) => update('grade', v)}
            options={[
              { value: 'ALL', label: '전체 등급' },
              { value: 'A', label: 'A · 즉시 점검' },
              { value: 'B', label: 'B · 단기 점검' },
              { value: 'C', label: 'C · 정기 관리' },
              { value: 'D', label: 'D · 낮음' }
            ]}
          />
          <FilterSelect
            label="출처"
            value={filters.source}
            onChange={(v) => update('source', v)}
            options={[
              { value: 'ALL', label: '전체 출처' },
              { value: 'real', label: '실제 공공데이터' },
              { value: 'sample', label: '샘플' },
              { value: 'upload', label: '업로드' }
            ]}
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{shownCount}</span>
            <span className="mx-1 text-slate-400">/</span>
            <span>{totalCount}개</span>
          </div>
          {onOpenFreshness && (
            <button
              onClick={onOpenFreshness}
              title="외부 데이터의 마지막 갱신 시각·출처·주기"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-forest-500" />
              {freshnessLabel ? `데이터 ${freshnessLabel} 갱신` : '데이터 신선도'}
            </button>
          )}
          {onOpenScoring && (
            <button
              onClick={onOpenScoring}
              title="6요인 raw 데이터·변환 산식·정직성 분류 전체 공개"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              산식·출처 보기
            </button>
          )}
          {onOpenComplaint && (
            <button
              onClick={onOpenComplaint}
              title="새올·신문고 등 기존 행정시스템에서 export한 민원 CSV 업로드"
              className="relative rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              + 민원 데이터
              {complaintCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                  {complaintCount}
                </span>
              )}
            </button>
          )}
          {onOpenCsv && (
            <button
              onClick={onOpenCsv}
              className="rounded-md border border-forest-200 bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-700 hover:bg-forest-100"
            >
              + 사이트 CSV
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function SearchInput({ value, onChange }) {
  return (
    <div className="relative flex items-center">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        id="site-search"
        name="siteSearch"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="대상명·주소·수종·관리기관 검색"
        className="w-56 rounded-md border border-slate-300 bg-white py-1.5 pl-7 pr-7 text-sm text-slate-800 outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="검색 지우기"
          className="absolute right-1 rounded-sm px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function SourcePill({ tone, label, title }) {
  const cls =
    {
      forest: 'bg-forest-50 text-forest-700 border-forest-200',
      slate: 'bg-slate-100 text-slate-600 border-slate-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200'
    }[tone] || 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
