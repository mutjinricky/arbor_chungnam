import React, { useMemo, useState } from 'react'
import Header from './components/Header.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import PriorityTable from './components/PriorityTable.jsx'
import MapView from './components/MapView.jsx'
import HeatmapView from './components/HeatmapView.jsx'
import SiteDetail from './components/SiteDetail.jsx'
import AddRecordModal from './components/AddRecordModal.jsx'
import CsvUpload from './components/CsvUpload.jsx'
import ComplaintUpload from './components/ComplaintUpload.jsx'
import ScoringInfoModal from './components/ScoringInfoModal.jsx'
import DataFreshnessModal from './components/DataFreshnessModal.jsx'
import { DATA_FRESHNESS, ageLabel } from './lib/dataFreshness.js'
import {
  SITES,
  INITIAL_RECORDS,
  REAL_COUNT,
  SAMPLE_COUNT
} from './data/loadSites.js'
import { enrichSite, applyComplaintBonus } from './lib/risk.js'
import { recommendActions } from './lib/recommend.js'

export default function App() {
  const [uploadedSites, setUploadedSites] = useState([])
  // 민원 누적 (브라우저 메모리) — enrichedAll에서 사용하므로 먼저 선언
  const [complaintsBySite, setComplaintsBySite] = useState({})
  const [complaintsByCity, setComplaintsByCity] = useState({})

  const allSites = useMemo(() => {
    const seen = new Set(SITES.map((s) => s.id))
    const extra = uploadedSites.filter((s) => !seen.has(s.id))
    return [...SITES, ...extra]
  }, [uploadedSites])

  const enrichedAll = useMemo(() => {
    const base = allSites.map(enrichSite)
    return base.map((s) =>
      applyComplaintBonus(s, complaintsBySite[s.id] || [])
    )
  }, [allSites, complaintsBySite])

  const [filters, setFilters] = useState({
    city: 'ALL',
    type: 'ALL',
    grade: 'ALL',
    source: 'ALL',
    query: ''
  })
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [selectedId, setSelectedId] = useState(
    [...enrichedAll].sort((a, b) => b.total_risk_score - a.total_risk_score)[0]
      ?.id || null
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [scoringOpen, setScoringOpen] = useState(false)
  const [freshnessOpen, setFreshnessOpen] = useState(false)
  const [centerView, setCenterView] = useState('map') // 'map' | 'heatmap'

  const cities = useMemo(
    () => Array.from(new Set(enrichedAll.map((s) => s.city))).sort(),
    [enrichedAll]
  )

  const filtered = useMemo(() => {
    const q = (filters.query || '').toLowerCase().trim()
    return enrichedAll.filter((s) => {
      if (filters.city !== 'ALL' && s.city !== filters.city) return false
      if (filters.type !== 'ALL' && s.type !== filters.type) return false
      if (filters.grade !== 'ALL' && s.risk_grade !== filters.grade) return false
      if (filters.source !== 'ALL' && s.data_source !== filters.source) return false
      if (q) {
        const hay = [s.name, s.address, s.main_species, s.city, s.managing_agency, s.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enrichedAll, filters])

  const selected = filtered.find((s) => s.id === selectedId) || null

  const totalEstimatedCost = useMemo(() => {
    return filtered
      .filter((s) => s.risk_grade === 'A' || s.risk_grade === 'B')
      .reduce((acc, s) => acc + recommendActions(s).estimated_cost_krw, 0)
  }, [filtered])

  function handleAddRecord(record) {
    if (!selected) return
    setRecords((prev) => {
      const list = prev[selected.id] || []
      const nextId = list.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1
      return {
        ...prev,
        [selected.id]: [{ id: nextId, ...record }, ...list]
      }
    })
    setModalOpen(false)
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <Header
        cities={cities}
        filters={filters}
        setFilters={setFilters}
        totalCount={enrichedAll.length}
        shownCount={filtered.length}
        onOpenCsv={() => setCsvOpen(true)}
        onOpenComplaint={() => setComplaintOpen(true)}
        onOpenScoring={() => setScoringOpen(true)}
        onOpenFreshness={() => setFreshnessOpen(true)}
        freshnessLabel={(() => {
          const fr = DATA_FRESHNESS.find((d) => d.key === 'fire_risk')
          return fr?.fetched_at ? ageLabel(fr.fetched_at) : null
        })()}
        complaintCount={Object.values(complaintsBySite).reduce(
          (a, l) => a + l.length,
          0
        )}
        realCount={REAL_COUNT}
        sampleCount={SAMPLE_COUNT}
        uploadedCount={uploadedSites.length}
      />

      <main className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* Left: summary + priority */}
        <aside className="col-span-4 flex flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-xs font-semibold text-slate-700">
              충남 통합 현황
            </div>
            <div className="text-[10px] text-slate-400">
              샘플 데이터 · 발표 시연용 (실제 운영 시 API 연동)
            </div>
          </div>
          <div className="px-4 py-3">
            <SummaryCards
              sites={filtered}
              totalEstimatedCost={totalEstimatedCost}
            />
          </div>
          <div className="min-h-0 flex-1 border-t border-slate-200">
            <PriorityTable
              sites={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              complaintsBySite={complaintsBySite}
            />
          </div>
        </aside>

        {/* Center: map or heatmap */}
        <section className="col-span-5 relative flex flex-col">
          <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
            <ViewTab
              active={centerView === 'map'}
              onClick={() => setCenterView('map')}
              label="지도"
            />
            <ViewTab
              active={centerView === 'heatmap'}
              onClick={() => setCenterView('heatmap')}
              label="시군별 분석"
            />
          </div>
          <div className="relative flex-1 overflow-hidden">
            {centerView === 'map' ? (
              <MapView
                sites={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                allSitesCount={enrichedAll.length}
              />
            ) : (
              <HeatmapView
                sites={filtered}
                selectedCity={filters.city !== 'ALL' ? filters.city : null}
                onCityClick={(city) =>
                  setFilters((f) => ({
                    ...f,
                    city: f.city === city ? 'ALL' : city
                  }))
                }
              />
            )}
          </div>
        </section>

        {/* Right: detail */}
        <aside className="col-span-3 overflow-hidden border-l border-slate-200 bg-white">
          <SiteDetail
            site={selected}
            records={selected ? records[selected.id] || [] : []}
            complaints={selected ? complaintsBySite[selected.id] || [] : []}
            cityComplaints={
              selected ? complaintsByCity[selected.city] || [] : []
            }
            onAddRecord={() => setModalOpen(true)}
          />
        </aside>
      </main>

      {modalOpen && selected && (
        <AddRecordModal
          site={selected}
          onClose={() => setModalOpen(false)}
          onSave={handleAddRecord}
        />
      )}

      {csvOpen && (
        <CsvUpload
          onClose={() => setCsvOpen(false)}
          onIngested={(sites) => {
            setUploadedSites((prev) => [...prev, ...sites])
            setCsvOpen(false)
            if (sites[0]) setSelectedId(sites[0].id)
          }}
        />
      )}

      {scoringOpen && (
        <ScoringInfoModal onClose={() => setScoringOpen(false)} />
      )}

      {freshnessOpen && (
        <DataFreshnessModal onClose={() => setFreshnessOpen(false)} />
      )}

      {complaintOpen && (
        <ComplaintUpload
          sites={enrichedAll}
          onClose={() => setComplaintOpen(false)}
          onIngested={(r) => {
            // 누적 (기존 + 신규)
            setComplaintsBySite((prev) => {
              const next = { ...prev }
              for (const [sid, list] of Object.entries(r.bySite)) {
                next[sid] = (next[sid] || []).concat(list)
              }
              return next
            })
            setComplaintsByCity((prev) => {
              const next = { ...prev }
              for (const [city, list] of Object.entries(r.byCity)) {
                next[city] = (next[city] || []).concat(list)
              }
              return next
            })
            setComplaintOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ViewTab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
        active
          ? 'bg-forest-600 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )
}
