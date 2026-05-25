import React, { useState } from 'react'
import { ingestCsvFile } from '../lib/csvIngest.js'

const SCHEMA_LABEL = {
  pine_forest: '소나무숲 표준',
  street_tree: '가로수길 표준',
  park: '도시공원 표준',
  unknown: '인식 실패'
}

export default function CsvUpload({ onClose, onIngested }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await ingestCsvFile(file)
      setResult(r)
      if (r.sites.length > 0) {
        // 자동 주입 대신 미리보기 후 사용자가 "추가하기" 누르도록
      }
    } catch (e) {
      setError(e.message || '파싱 실패')
    } finally {
      setBusy(false)
    }
  }

  function confirmIngest() {
    if (!result || result.sites.length === 0) return
    onIngested(result.sites)
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              충남 공공데이터 CSV 업로드
            </div>
            <div className="text-xs text-slate-500">
              소나무숲 · 가로수길 · 도시공원 표준데이터 (EUC-KR / UTF-8 자동 감지)
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
              {busy ? '파싱 중…' : 'CSV 파일을 선택하거나 클릭'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              data.go.kr · alldam.chungnam.go.kr 에서 받은 원본 CSV를 그대로 올리세요
            </div>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              오류: {error}
            </div>
          )}

          {result && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span>
                  스키마: <strong>{SCHEMA_LABEL[result.schema] || result.schema}</strong>
                </span>
                <span>
                  총 {result.total}행 · 변환 성공{' '}
                  <strong className="text-forest-700">{result.sites.length}</strong>
                  {result.dropped > 0 && ` · 누락 ${result.dropped}`}
                </span>
              </div>
              {result.schema === 'unknown' && (
                <div className="mt-2 text-[11px] text-slate-500">
                  인식된 컬럼: {result.headers?.join(', ')}
                </div>
              )}
              {result.sites.length > 0 && (
                <div className="mt-2 max-h-32 overflow-auto text-[11px] text-slate-600">
                  미리보기 (최대 5건):
                  <ul className="mt-1 list-disc pl-4">
                    {result.sites.slice(0, 5).map((s) => (
                      <li key={s.id}>
                        {s.name} · {s.city} · {s.main_species}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            지원 표준데이터: <br />
            ① 충청남도 100대 소나무숲 (시군/읍면/리/번지/대상면적/주요명칭)<br />
            ② 충청남도 가로수길정보표준데이터 (가로수길명/시군구/위도/경도 등)<br />
            ③ 전국도시공원정보표준데이터 (공원명/소재지/공원유형 등)
          </div>

          <div className="rounded-md border border-forest-200 bg-forest-50/40 px-3 py-2 text-[11px] text-slate-700">
            <div className="mb-1 font-semibold text-forest-800">
              🧪 시연용 샘플
            </div>
            <a
              href="/samples/demo_streets_chungnam.csv"
              download
              className="inline-flex items-center gap-1 text-forest-700 hover:underline"
            >
              📥 demo_streets_chungnam.csv
            </a>
            <span className="ml-1.5 text-slate-500">
              — 충남 12개 가로수길 (곡교천 은행나무길 등)
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
            disabled={!result || result.sites.length === 0}
            className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {result?.sites.length
              ? `${result.sites.length}개 추가`
              : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
