import React, { useEffect, useRef, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { gradeColor } from '../lib/risk.js'
import { TYPE_LABELS } from '../data/sites.js'

// 사이트 마커 (divIcon — MarkerClusterGroup이 일반 Marker만 클러스터링하므로 CircleMarker 대신 사용)
function makeMarkerIcon(grade, isSelected) {
  const color = gradeColor(grade) || '#94a3b8'
  const size = isSelected ? 22 : 14
  return L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:9999px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`,
    className: 'dryad-site-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

const CHUNGNAM_CENTER = [36.55, 126.95]
const DEFAULT_ZOOM = 9

function FlyToSelected({ site }) {
  const map = useMap()
  useEffect(() => {
    if (site) {
      map.flyTo([site.latitude, site.longitude], 11, { duration: 0.6 })
    }
  }, [site, map])
  return null
}

// 컨테이너가 flex로 늦게 크기 잡힐 때 Leaflet이 0x0으로 굳어버리는 문제 해결.
// 마운트 직후 + 컨테이너 resize 시마다 invalidateSize 호출.
function MapSizeFixer() {
  const map = useMap()
  useEffect(() => {
    const trigger = () => {
      try {
        map.invalidateSize({ pan: false })
        // moveend/zoomend 이벤트를 명시적으로 발화하여 MarkerClusterGroup이
        // 클러스터를 재계산하도록 강제
        map.fire('moveend')
        map.fire('zoomend')
      } catch {
        /* map already disposed */
      }
    }
    const t1 = setTimeout(trigger, 50)
    const t2 = setTimeout(trigger, 250)
    const t3 = setTimeout(trigger, 800)
    const container = map.getContainer()
    const ro = new ResizeObserver(trigger)
    ro.observe(container)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      ro.disconnect()
    }
  }, [map])
  return null
}

function buildClusterIcon(cluster) {
  const markers = cluster.getAllChildMarkers()
  const count = markers.length
  // 클러스터 내 최고 위험등급 추출하여 색상 결정
  const gradeOrder = { A: 4, B: 3, C: 2, D: 1 }
  let topGrade = 'D'
  for (const m of markers) {
    const g = m.options.dryadGrade
    if (g && gradeOrder[g] > gradeOrder[topGrade]) topGrade = g
  }
  const color = gradeColor(topGrade)
  const size = count < 10 ? 32 : count < 50 ? 40 : count < 200 ? 48 : 56
  return L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;line-height:${size}px;border-radius:9999px;color:white;font-weight:700;font-size:13px;text-align:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${count}</div>`,
    className: 'dryad-cluster',
    iconSize: L.point(size, size)
  })
}

export default function MapView({ sites, selectedId, onSelect, allSitesCount }) {
  const containerRef = useRef(null)
  const selected = sites.find((s) => s.id === selectedId)
  // 마운트 직후 MarkerClusterGroup 강제 리마운트 — 지도 사이즈 잡힌 뒤 클러스터를 새로 계산하기 위함
  const [clusterReady, setClusterReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setClusterReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <MapContainer
        center={CHUNGNAM_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        preferCanvas
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | DRYAD MVP'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup
          key={clusterReady ? 'ready' : 'initial'}
          maxClusterRadius={60}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          disableClusteringAtZoom={14}
          iconCreateFunction={buildClusterIcon}
        >
          {sites.map((s) => {
            const isSelected = s.id === selectedId
            return (
              <Marker
                key={s.id}
                position={[s.latitude, s.longitude]}
                icon={makeMarkerIcon(s.risk_grade, isSelected)}
                dryadGrade={s.risk_grade}
                eventHandlers={{ click: () => onSelect(s.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="text-xs">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-slate-500">
                      {s.city} · {TYPE_LABELS[s.type]} · {s.main_species}
                    </div>
                    <div className="mt-1">
                      위험도{' '}
                      <span
                        className="font-semibold"
                        style={{ color: gradeColor(s.risk_grade) }}
                      >
                        {s.total_risk_score} ({s.risk_grade})
                      </span>
                    </div>
                  </div>
                </Tooltip>
              </Marker>
            )
          })}
        </MarkerClusterGroup>
        <FlyToSelected site={selected} />
        <MapSizeFixer />
      </MapContainer>

      <Legend total={allSitesCount} shown={sites.length} />
    </div>
  )
}

function Legend({ total, shown }) {
  const items = [
    { grade: 'A', label: '즉시 점검 (80~)' },
    { grade: 'B', label: '단기 점검 (60~79)' },
    { grade: 'C', label: '정기 관리 (40~59)' },
    { grade: 'D', label: '낮은 위험 (~39)' }
  ]
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur">
      <div className="mb-1.5 font-semibold text-slate-700">
        위험등급 범례
      </div>
      <div className="space-y-1">
        {items.map((it) => (
          <div key={it.grade} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border border-white shadow"
              style={{ background: gradeColor(it.grade) }}
            />
            <span className="text-slate-600">{it.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] text-slate-500">
        표시 {shown}개 / 전체 {total}개
      </div>
    </div>
  )
}
