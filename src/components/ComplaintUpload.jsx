import React, { useState } from 'react'
import { ingestComplaintCsv } from '../lib/complaintIngest.js'

export default function ComplaintUpload({ sites, onClose, onIngested }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await ingestComplaintCsv(file, sites)
      setResult(r)
    } catch (e) {
      setError(e.message || '파싱 실패')
    } finally {
      setBusy(false)
    }
  }

  function confirmIngest() {
    if (!result || result.complaints.length === 0) return
    onIngested(result)
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              민원 데이터 CSV 업로드
            </div>
            <div className="text-xs text-slate-500">
              새올행정시스템 · 국민신문고 · 안전신문고에서 export한 수목 관련 민원
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-forest-400 hover:bg-forest-50/30">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="text-sm font-medium text-slate-700">
              {busy ? '파싱 + 사이트 매칭 중…' : 'CSV 선택 또는 클릭'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              EUC-KR · UTF-8 자동 감지 · 좌표 있으면 500m 이내 가장 가까운 사이트에 자동 귀속
            </div>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              오류: {error}
            </div>
          )}

          {result && result.schema === 'complaint' && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  총 <strong>{result.total}</strong>건 민원 ·
                  사이트 매칭{' '}
                  <strong className="text-forest-700">
                    {result.total - result.unmatched}
                  </strong>
                  /<span className="text-slate-500">{result.total}</span>
                </span>
                <span className="text-slate-500">
                  미매칭 {result.unmatched}건은 시군 단위 집계만
                </span>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                매칭된 사이트 (상위 5개):
              </div>
              <ul className="mt-1 max-h-32 overflow-auto text-[11px] text-slate-700">
                {Object.entries(result.bySite)
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, 5)
                  .map(([sid, list]) => (
                    <li key={sid} className="border-b border-slate-100 py-1">
                      <span className="font-medium text-slate-800">{sid}</span>{' '}
                      — {list.length}건
                    </li>
                  ))}
              </ul>

              <div className="mt-3 text-[11px] text-slate-500">
                시군별 분포:
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                {Object.entries(result.byCity)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([city, list]) => (
                    <span
                      key={city}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5"
                    >
                      {city} <strong className="text-slate-700">{list.length}</strong>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {result && result.schema === 'unknown' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              민원 CSV 형식이 감지되지 않았습니다. <br />
              인식된 컬럼: {result.headers?.join(', ')}
              <br />
              필요한 컬럼: 시군 + (주소 또는 위도/경도)
            </div>
          )}

          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            지원 컬럼 예시: <br />
            <code>시군, 주소(또는 위도/경도), 민원ID, 접수일자, 민원유형, 처리상태, 내용</code>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-[11px] text-slate-700">
            <div className="mb-1 font-semibold text-amber-800">
              🧪 시연용 샘플
            </div>
            <a
              href="/samples/demo_complaints_chungnam.csv"
              download
              className="inline-flex items-center gap-1 text-amber-800 hover:underline"
            >
              📥 demo_complaints_chungnam.csv
            </a>
            <span className="ml-1.5 text-slate-500">
              — 50건, 충남 15개 시군 (사직동·곡교천 누적 효과 시연)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            onClick={confirmIngest}
            disabled={!result || result.complaints.length === 0}
            className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {result?.complaints.length
              ? `${result.complaints.length}건 주입`
              : '주입'}
          </button>
        </div>
      </div>
    </div>
  )
}
