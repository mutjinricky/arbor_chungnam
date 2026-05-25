// 형식 보고서 레이아웃 (off-screen 렌더링 → html2canvas → jsPDF)
// 한국어 폰트는 Pretendard (index.html에서 로드됨)

import React, { forwardRef } from 'react'
import { TYPE_LABELS } from '../data/sites.js'
import {
  RISK_FACTOR_LABELS,
  RISK_WEIGHTS,
  gradeColor,
  gradeMeaning
} from '../lib/risk.js'
import { estimateAnnualCarbon, formatCarbon } from '../lib/carbon.js'

const TYPE_COLORS = {
  park: '#3f7f54',
  street_tree: '#ea7a18',
  pine_forest: '#1d4d2f',
  forest_adjacent: '#65543f'
}

const SiteReport = forwardRef(function SiteReport(
  { site, records = [], complaints = [], rec },
  ref
) {
  if (!site) return null

  const factors = Object.entries(site.risk)
    .filter(([k]) => k.endsWith('_score'))
    .sort((a, b) => RISK_WEIGHTS[b[0]] - RISK_WEIGHTS[a[0]])

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: '-9999px',
        width: '794px', // A4 width at 96dpi
        background: 'white',
        fontFamily:
          "'Pretendard', 'Noto Sans KR', system-ui, sans-serif",
        color: '#1a202c',
        padding: '32px 36px'
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #1d4d2f',
          paddingBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              background: '#1d4d2f',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '20px'
            }}
          >
            🌳
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              DRYAD 충남 AI 수목관리 의사결정 시스템
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
              수목관리 위험도 보고서
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280' }}>
          생성일: {dateStr}
          <br />
          보고서 ID: DRYAD-{site.id}
        </div>
      </div>

      {/* 1. 대상 정보 */}
      <Section title="1. 대상 정보">
        <table style={tableStyle()}>
          <tbody>
            <Row label="대상 명칭" value={site.name} />
            <Row label="대상 ID" value={site.id} />
            <Row label="유형" value={TYPE_LABELS[site.type] || site.type} />
            <Row label="시군" value={site.city} />
            <Row label="주요 수종" value={site.main_species} />
            <Row label="관리기관" value={site.managing_agency} />
            <Row label="주소" value={site.address} />
            <Row
              label="규모"
              value={
                site.area_m2
                  ? `${site.area_m2.toLocaleString()} m²`
                  : site.length_m
                  ? `${site.length_m.toLocaleString()} m 구간`
                  : '-'
              }
            />
            <Row
              label="조성·식재"
              value={
                site._established_years != null
                  ? `${today.getFullYear() - site._established_years}년 (${site._established_years}년 경과)`
                  : '-'
              }
            />
            <Row
              label="연간 탄소 흡수"
              value={(() => {
                const c = estimateAnnualCarbon(site)
                return c > 0
                  ? `${formatCarbon(c)} /년 (산림청 도시숲 기준 추정)`
                  : '-'
              })()}
            />
          </tbody>
        </table>
      </Section>

      {/* 2. 위험도 평가 */}
      <Section title="2. 위험도 평가">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: '#f8fafb',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '10px'
          }}
        >
          <div style={{ textAlign: 'center', minWidth: '80px' }}>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 800,
                color: gradeColor(site.risk_grade),
                lineHeight: 1
              }}
            >
              {site.total_risk_score}
            </div>
            <div
              style={{
                marginTop: '6px',
                padding: '3px 8px',
                background: gradeColor(site.risk_grade),
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '999px',
                display: 'inline-block'
              }}
            >
              {site.risk_grade}등급
            </div>
          </div>
          <div style={{ flex: 1, fontSize: '12px' }}>
            <div style={{ color: '#475569' }}>{gradeMeaning(site.risk_grade)}</div>
            {site.complaint_bonus > 0 && (
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#92400e' }}>
                원점수 {site.total_risk_score_base?.toFixed(1)} + 민원 가산{' '}
                <strong>{site.complaint_bonus}</strong>점 (
                {site.risk_grade_base !== site.risk_grade &&
                  `등급 ${site.risk_grade_base} → ${site.risk_grade}, `}
                민원 {site.complaint_count}건 누적)
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
          6요인 분석 (가중평균):
        </div>
        <table style={{ ...tableStyle(), fontSize: '11px' }}>
          <tbody>
            {factors.map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '4px 6px', width: '120px', color: '#475569' }}>
                  {RISK_FACTOR_LABELS[k]}
                </td>
                <td style={{ padding: '4px 6px', width: '40px', textAlign: 'right', fontWeight: 600 }}>
                  {Math.round(v)}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <div
                    style={{
                      height: '6px',
                      background: '#e2e8f0',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${v}%`,
                        height: '100%',
                        background:
                          v >= 80
                            ? '#dc2626'
                            : v >= 60
                            ? '#ea7a18'
                            : v >= 40
                            ? '#eab308'
                            : '#3f7f54'
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: '4px 6px', width: '60px', textAlign: 'right', color: '#6b7280', fontSize: '10px' }}>
                  × {RISK_WEIGHTS[k]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 3. AI 추천 조치 */}
      {rec && (
        <Section title="3. AI 추천 조치">
          <div
            style={{
              background: '#f0f7f2',
              border: '1px solid #c8e1d0',
              borderLeft: '3px solid #3f7f54',
              borderRadius: '4px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: 1.6,
              marginBottom: '10px'
            }}
          >
            {rec.summary}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
            <ActionBox rank="1순위" action={rec.primary?.action} />
            {rec.secondary && (
              <ActionBox rank="2순위" action={rec.secondary.action} />
            )}
            <div style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#475569' }}>
              예상 비용 합계
              <br />
              <strong style={{ fontSize: '14px', color: '#1a202c' }}>
                {rec.estimated_cost_krw?.toLocaleString()}원
              </strong>
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px' }}>
            ※ 본 추천은 공공데이터 기반 위험도 추정값이며 행정 판단 보조용입니다. 실제 조치 전 나무의사·현장 담당자 확인이 필요합니다.
          </div>
        </Section>
      )}

      {/* 4. 관리이력 */}
      <Section title={`4. 관리이력 (${records.length}건)`}>
        {records.length === 0 ? (
          <div style={emptyBoxStyle()}>등록된 관리이력 없음</div>
        ) : (
          <table style={tableStyle()}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <Th width="80">관리일자</Th>
                <Th width="70">유형</Th>
                <Th>조치내용</Th>
                <Th width="80">담당</Th>
                <Th width="80">비용</Th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <Td>{r.action_date}</Td>
                  <Td>{r.action_type}</Td>
                  <Td>{r.description || '-'}</Td>
                  <Td>{r.manager || '-'}</Td>
                  <Td>{r.cost_krw ? `${r.cost_krw.toLocaleString()}원` : '-'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 5. 민원·신고 */}
      {complaints.length > 0 && (
        <Section title={`5. 민원·신고 (${complaints.length}건)`}>
          <table style={tableStyle()}>
            <thead>
              <tr style={{ background: '#fef3c7' }}>
                <Th width="80">접수일</Th>
                <Th width="70">유형</Th>
                <Th width="70">상태</Th>
                <Th>내용</Th>
              </tr>
            </thead>
            <tbody>
              {complaints.slice(0, 5).map((c) => (
                <tr key={c.id}>
                  <Td>{c.date || '-'}</Td>
                  <Td>{c.type}</Td>
                  <Td>{c.status}</Td>
                  <Td>{c.content || '-'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* 푸터 */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '9px',
          color: '#94a3b8',
          lineHeight: 1.6
        }}
      >
        <div>
          <strong>데이터 출처</strong>: 산림청 산불위험예보 API · 기상청 단기예보 API · 농진청 토양도 V2 · KOSIS 산림청 산불통계 · {site.source_dataset || '충남 표준데이터셋'}
        </div>
        <div style={{ marginTop: '4px' }}>
          <strong>산식 명세</strong>: SCORING.md · 기획서 9.1 6요인 가중평균 + 민원 가산점 모델
        </div>
        <div style={{ marginTop: '4px' }}>
          DRYAD MVP · 제14회 충남 공공데이터·AI 활용 창업경진대회 출품
        </div>
      </div>
    </div>
  )
})

function Section({ title, children }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#1d4d2f',
          marginBottom: '8px',
          paddingBottom: '4px',
          borderBottom: '1px solid #c8e1d0'
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function tableStyle() {
  return {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px'
  }
}

function emptyBoxStyle() {
  return {
    border: '1px dashed #e2e8f0',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center'
  }
}

function Row({ label, value }) {
  return (
    <tr>
      <td
        style={{
          padding: '4px 8px',
          width: '90px',
          color: '#6b7280',
          background: '#f8fafb',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        {label}
      </td>
      <td style={{ padding: '4px 10px', borderBottom: '1px solid #f1f5f9' }}>
        {value || '-'}
      </td>
    </tr>
  )
}

function Th({ children, width }) {
  return (
    <th
      style={{
        padding: '5px 8px',
        textAlign: 'left',
        fontSize: '10px',
        fontWeight: 600,
        color: '#475569',
        borderBottom: '1px solid #cbd5e1',
        width: width
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }) {
  return (
    <td
      style={{
        padding: '5px 8px',
        fontSize: '11px',
        borderBottom: '1px solid #f1f5f9',
        verticalAlign: 'top'
      }}
    >
      {children}
    </td>
  )
}

function ActionBox({ rank, action }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #c8e1d0',
        borderRadius: '4px',
        padding: '6px 10px',
        minWidth: '90px'
      }}
    >
      <div style={{ fontSize: '9px', color: '#3f7f54', fontWeight: 700 }}>
        {rank}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
        {action}
      </div>
    </div>
  )
}

export default SiteReport
