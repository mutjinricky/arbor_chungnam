import React, { useState, useEffect } from 'react'
import { ACTION_TYPES, ACTION_UNIT_COST } from '../data/sites.js'

const today = () => new Date().toISOString().slice(0, 10)

function plusMonths(dateStr, months) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export default function AddRecordModal({ site, onClose, onSave }) {
  const [form, setForm] = useState({
    action_type: '현장점검',
    action_date: today(),
    description: '',
    manager: '',
    contractor: '',
    cost_krw: ACTION_UNIT_COST['현장점검'],
    next_inspection_date: plusMonths(today(), 6)
  })

  useEffect(() => {
    setForm((f) => ({ ...f, cost_krw: ACTION_UNIT_COST[f.action_type] || 0 }))
  }, [form.action_type])

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e) {
    e.preventDefault()
    onSave({
      ...form,
      cost_krw: Number(form.cost_krw) || 0
    })
  }

  if (!site) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              관리이력 추가
            </div>
            <div className="text-xs text-slate-500">
              {site.name} · {site.city}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Row label="관리유형">
            <select
              value={form.action_type}
              onChange={(e) => update('action_type', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Row>

          <div className="grid grid-cols-2 gap-3">
            <Row label="관리일자">
              <input
                type="date"
                value={form.action_date}
                onChange={(e) => update('action_date', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Row>
            <Row label="다음 점검일">
              <input
                type="date"
                value={form.next_inspection_date}
                onChange={(e) =>
                  update('next_inspection_date', e.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Row>
          </div>

          <Row label="조치내용">
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              placeholder="예) 보행로 인접 가지 정리, 고사가지 일부 제거"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Row>

          <div className="grid grid-cols-2 gap-3">
            <Row label="담당자">
              <input
                type="text"
                value={form.manager}
                onChange={(e) => update('manager', e.target.value)}
                placeholder="부서·담당자명"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Row>
            <Row label="용역업체">
              <input
                type="text"
                value={form.contractor}
                onChange={(e) => update('contractor', e.target.value)}
                placeholder="업체명 또는 -"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Row>
          </div>

          <Row label="비용 (원)">
            <input
              type="number"
              value={form.cost_krw}
              onChange={(e) => update('cost_krw', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Row>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  )
}
