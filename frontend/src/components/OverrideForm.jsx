import { useState } from 'react'
import { overrideItem } from '../lib/api.js'

const VERDICTS = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'flagged',   label: '⚑  Flagged — needs attention' },
  { value: 'rejected',  label: 'Rejected' },
]

export default function OverrideForm({ item, onSaved, onCancel }) {
  const ALLOWED = ['compliant', 'flagged', 'rejected']
  const defaultVerdict = ALLOWED.includes(item.override_verdict || item.verdict)
    ? (item.override_verdict || item.verdict)
    : 'flagged'
  const [form, setForm] = useState({ verdict: defaultVerdict, reviewer: '', comment: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.comment.trim())  return alert('Comment is required')
    if (!form.reviewer.trim()) return alert('Reviewer name is required')
    setSaving(true)
    try {
      onSaved(await overrideItem(item.id, form))
    } catch (e) {
      alert('Override failed: ' + (e.response?.data?.detail || e.message))
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3 animate-in">
      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Override Verdict</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">New Verdict</label>
          <select value={form.verdict} onChange={e => setForm(f => ({ ...f, verdict: e.target.value }))} className="select text-sm">
            {VERDICTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Your Name</label>
          <input value={form.reviewer} onChange={e => setForm(f => ({ ...f, reviewer: e.target.value }))} placeholder="Reviewer" className="input text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Comment <span className="text-rose-500">*</span></label>
        <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
          placeholder="Reason for override…" rows={3} className="input text-sm resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">{saving ? 'Saving…' : 'Save Override'}</button>
        <button onClick={onCancel} className="btn-secondary text-xs">Cancel</button>
      </div>
    </div>
  )
}
