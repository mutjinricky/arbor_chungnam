import React, { useRef, useState } from 'react'
import {
  RISK_FACTOR_LABELS,
  RISK_FACTOR_SOURCE_DEFAULT,
  SOURCE_LABEL,
  gradeBadgeClass,
  gradeColor,
  gradeMeaning
} from '../lib/risk.js'
import { TYPE_LABELS } from '../data/sites.js'
import { recommendActions, formatKRW } from '../lib/recommend.js'
import { estimateAnnualCarbon, formatCarbon } from '../lib/carbon.js'
import SiteReport from './SiteReport.jsx'

export default function SiteDetail({ site, records, complaints = [], cityComplaints = [], onAddRecord }) {
  const reportRef = useRef(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  if (!site) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
        지도 또는 우선순위 목록에서 대상지를 선택하면 상세정보가 표시됩니다.
      </div>
    )
  }

  const rec = recommendActions(site)

  async function downloadPdf() {
    if (!reportRef.current) return
    setPdfBusy(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const el = reportRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth() // 210
      const pageHeight = pdf.internal.pageSize.getHeight() // 297
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * pageWidth) / canvas.width

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      } else {
        // 다중 페이지 처리
        let position = 0
        while (position < imgHeight) {
          if (position > 0) pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight)
          position += pageHeight
        }
      }
      const safe = site.name.replace(/[^가-힣a-zA-Z0-9_-]/g, '_').slice(0, 40)
      pdf.save(`DRYAD_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error(e)
      alert('PDF 생성 실패: ' + e.message)
    } finally {
      setPdfBusy(false)
    }
  }
  const factors = Object.entries(site.risk)
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="scrollbar-thin flex h-full flex-col overflow-y-auto">
      {/* 오프스크린 PDF 보고서 (html2canvas 대상) */}
      <SiteReport
        ref={reportRef}
        site={site}
        records={records}
        complaints={complaints}
        rec={rec}
      />
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
              <span>{site.id}</span>
              <SourceTag source={site.data_source} approx={site._coord_approx} />
            </div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">
              {site.name}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {site.city} · {TYPE_LABELS[site.type]} · {site.main_species}
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: gradeColor(site.risk_grade) }}
            >
              {site.total_risk_score}
            </div>
            {site.complaint_bonus > 0 && (
              <div className="mt-0.5 text-[10px] text-amber-700">
                원점수 {site.total_risk_score_base?.toFixed(1)} +{' '}
                <strong>민원 가산 {site.complaint_bonus}</strong>
              </div>
            )}
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${gradeBadgeClass(
                site.risk_grade
              )}`}
            >
              {site.risk_grade}등급 · {gradeMeaning(site.risk_grade)}
              {site.risk_grade_base && site.risk_grade_base !== site.risk_grade && (
                <span className="ml-1 text-[9px] font-normal opacity-70">
                  ({site.risk_grade_base} → {site.risk_grade})
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {pdfBusy ? '생성 중…' : '📄 PDF 보고서'}
          </button>
        </div>
      </div>

      <Section title="기본정보">
        <InfoGrid
          rows={[
            ['관리기관', site.managing_agency],
            ['주소', site.address],
            [
              '규모',
              site.area_m2
                ? site.area_m2.toLocaleString() + ' m²'
                : site.length_m
                ? site.length_m.toLocaleString() + ' m 구간'
                : '-'
            ],
            [
              '연간 탄소 흡수',
              (() => {
                const c = estimateAnnualCarbon(site)
                return c > 0 ? `${formatCarbon(c)} /년 (추정)` : '-'
              })()
            ],
            [
              '최근 관리 후',
              site.risk.last_management_days
                ? site.risk.last_management_days + '일 경과 (추정)'
                : '미상'
            ],
            ['데이터 출처', site.source_dataset]
          ]}
        />
      </Section>

      <Section
        title="위험도 구성"
        hint="요인별 데이터 출처는 우측 배지 참고"
      >
        <div className="space-y-2">
          {factors.map(([k, v]) => {
            const source =
              (site.risk_sources && site.risk_sources[k]) ||
              RISK_FACTOR_SOURCE_DEFAULT[k] ||
              'simulation'
            return (
              <FactorBar
                key={k}
                label={RISK_FACTOR_LABELS[k] || k}
                value={v}
                source={source}
              />
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
          <SourceLegend code="real" />
          <SourceLegend code="proxy" />
          <SourceLegend code="simulation" />
        </div>
      </Section>

      <Section title="AI 추천 조치" hint="규칙 기반 추론 · 행정 판단 보조용">
        <div className="rounded-lg border border-forest-100 bg-forest-50/60 p-3 text-sm leading-relaxed text-slate-800">
          {rec.summary}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionCard rank="1순위" action={rec.primary.action} />
          {rec.secondary && (
            <ActionCard rank="2순위" action={rec.secondary.action} />
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          예상 비용 합계 · {formatKRW(rec.estimated_cost_krw)}
        </div>
        <div className="mt-2 text-[10px] leading-relaxed text-slate-400">
          본 추천은 공공데이터 기반 위험도 추정값이며, 수목 질병의 확정 진단이
          아닙니다. 실제 조치 전 나무의사·현장 담당자 확인이 필요합니다.
        </div>
      </Section>

      {(complaints.length > 0 || cityComplaints.length > 0) && (
        <Section
          title={`민원·신고 (${complaints.length}건${
            cityComplaints.length > complaints.length
              ? ` · ${site.city} 전체 ${cityComplaints.length}건`
              : ''
          })`}
          hint="새올행정시스템·국민신문고 export · 좌표 기반 자동 매칭"
        >
          {complaints.length > 0 ? (
            <ul className="space-y-1.5">
              {complaints.slice(0, 6).map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">
                      {c.type}
                    </span>
                    <span className="text-slate-500">
                      {c.date || '날짜 미상'} ·{' '}
                      <span
                        className={
                          c.status === '처리완료'
                            ? 'text-forest-700'
                            : c.status === '접수'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }
                      >
                        {c.status}
                      </span>
                    </span>
                  </div>
                  {c.content && (
                    <div className="mt-0.5 text-slate-600">{c.content}</div>
                  )}
                  {c.matched_distance_m != null && (
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      좌표 거리 {c.matched_distance_m}m
                    </div>
                  )}
                </li>
              ))}
              {complaints.length > 6 && (
                <li className="px-3 text-[11px] text-slate-500">
                  외 {complaints.length - 6}건 더…
                </li>
              )}
            </ul>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-500">
              이 사이트 직접 매칭 없음 · {site.city} 단위로{' '}
              <strong>{cityComplaints.length}건</strong> 누적
            </div>
          )}
        </Section>
      )}

      <Section
        title="관리이력"
        right={
          <button
            onClick={onAddRecord}
            className="rounded-md bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-forest-700"
          >
            + 관리이력 추가
          </button>
        }
      >
        {records.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            등록된 관리이력이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {r.action_type}
                  </span>
                  <span className="text-slate-500">{r.action_date}</span>
                </div>
                {r.description && (
                  <div className="mt-1 text-slate-600">{r.description}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  {r.manager && <span>담당 {r.manager}</span>}
                  {r.contractor && r.contractor !== '-' && (
                    <span>용역 {r.contractor}</span>
                  )}
                  {r.cost_krw != null && <span>{formatKRW(r.cost_krw)}</span>}
                  {r.next_inspection_date && (
                    <span>차기점검 {r.next_inspection_date}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[10px] leading-relaxed text-slate-500">
        본 화면의 위험도와 추천 조치는 공공데이터 및 기획서 9.1의 규칙 기반
        산식으로 산출된 행정 판단 보조 정보입니다. 출처:{' '}
        <a
          href={site.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-forest-700 underline"
        >
          {site.source_dataset}
        </a>
      </div>
    </div>
  )
}

function SourceTag({ source, approx }) {
  const map = {
    real: { label: '공공데이터', cls: 'bg-forest-50 text-forest-700 border-forest-200' },
    sample: { label: '샘플', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    upload: { label: '업로드', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  const tag = map[source] || map.sample
  return (
    <span className="flex items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tag.cls}`}
      >
        {tag.label}
      </span>
      {approx && (
        <span
          className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700"
          title="원본에 정확한 좌표가 없어 시군 중심 기준 근사 위치입니다"
        >
          좌표근사
        </span>
      )}
    </span>
  )
}

function Section({ title, hint, right, children }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-700">{title}</div>
          {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function InfoGrid({ rows }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="col-span-1 text-slate-500">{k}</dt>
          <dd className="col-span-2 text-slate-800">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function FactorBar({ label, value, source }) {
  const pct = Math.max(0, Math.min(100, value))
  const color =
    value >= 80
      ? '#dc2626'
      : value >= 60
      ? '#ea7a18'
      : value >= 40
      ? '#eab308'
      : '#3f7f54'
  const tag = SOURCE_LABEL[source] || SOURCE_LABEL.simulation
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600">{label}</span>
          <span
            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tag.cls}`}
            title={SOURCE_TOOLTIPS[source] || ''}
          >
            {tag.label}
          </span>
        </div>
        <span className="font-semibold text-slate-800">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: pct + '%', background: color }}
        />
      </div>
    </div>
  )
}

const SOURCE_TOOLTIPS = {
  real: '보유 데이터 또는 매트릭스 기반 산출',
  proxy:
    '직접 데이터 미보유, 다른 컬럼으로 추정 (관리이력→조성·식재 후 경과)',
  simulation:
    '외부 API 미연결 상태의 시뮬레이션 값 (서비스키 받으면 실데이터로 교체)'
}

function SourceLegend({ code }) {
  const tag = SOURCE_LABEL[code]
  return (
    <span className="flex items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tag.cls}`}
      >
        {tag.label}
      </span>
      <span className="text-[10px] text-slate-400">
        {SOURCE_TOOLTIPS[code]}
      </span>
    </span>
  )
}

function ActionCard({ rank, action }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-forest-600">
        {rank}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800">
        {action}
      </div>
    </div>
  )
}
