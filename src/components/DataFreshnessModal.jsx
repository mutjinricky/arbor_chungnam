import React from 'react'
import { DATA_FRESHNESS, formatDate, ageLabel } from '../lib/dataFreshness.js'

export default function DataFreshnessModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">
              데이터 신선도
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              6요인 각각의 최신 갱신 시각 · 출처 · 갱신 주기
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
          <ul className="space-y-2">
            {DATA_FRESHNESS.map((d) => (
              <li
                key={d.key}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {d.label}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {d.source}
                    </div>
                    {d.reference && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        기준: {d.reference}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    {d.fetched_at ? (
                      <>
                        <div className="font-semibold text-forest-700">
                          {ageLabel(d.fetched_at)} 갱신
                        </div>
                        <div className="text-slate-400">
                          {formatDate(d.fetched_at)}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-400">정적 데이터</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    갱신주기: {d.refresh}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    단위: {d.granularity}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
            <div className="font-semibold text-slate-700">갱신 방법</div>
            <div className="mt-1">
              <code className="rounded bg-white px-1.5 py-0.5">
                node --env-file=.env scripts/fetchExternal.mjs
              </code>{' '}
              실행 후{' '}
              <code className="rounded bg-white px-1.5 py-0.5">
                node scripts/etl.mjs
              </code>{' '}
              로 ETL 재실행. 운영 시 cron 또는 GitHub Actions로 매일 자동 갱신.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
