import { useState } from 'react'
import VerdictBadge from './VerdictBadge.jsx'
import ConfidenceBar from './ConfidenceBar.jsx'
import PolicyClause from './PolicyClause.jsx'
import OverrideForm from './OverrideForm.jsx'
import AuditTrail from './AuditTrail.jsx'
import { deleteItem, getAuditLog } from '../lib/api.js'

const VB = { compliant:'vb-compliant', flagged:'vb-flagged', rejected:'vb-rejected', needs_review:'vb-flagged', ambiguous:'vb-flagged' }

function VerdictIcon({ verdict }) {
  const normalized = (verdict === 'needs_review' || verdict === 'ambiguous') ? 'flagged' : verdict

  if (normalized === 'compliant') return (
    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </div>
  )

  if (normalized === 'rejected') return (
    <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </div>
  )

  // flagged
  return (
    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    </div>
  )
}

export default function LineItemCard({ item, onUpdate, onDelete }) {
  const [expanded,     setExpanded]     = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [showAudit,    setShowAudit]    = useState(false)
  const [auditLogs,    setAuditLogs]    = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const verdict = item.override_verdict || item.verdict

  const loadAudit = async () => {
    if (!showAudit && !auditLogs) {
      try { setAuditLogs(await getAuditLog(item.id)) } catch { setAuditLogs([]) }
    }
    setShowAudit(v => !v)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${item.vendor || 'this expense'} ($${(item.amount||0).toFixed(2)})? This cannot be undone.`)) return
    setDeleting(true)
    try { await deleteItem(item.id); onDelete(item.id) }
    catch (e) { alert('Delete failed: ' + (e.response?.data?.detail || e.message)); setDeleting(false) }
  }

  return (
    <div className={`card overflow-hidden transition-all duration-200 ${VB[verdict] || VB.ambiguous}`}>
      {/* Collapsed row */}
      <div onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors">

        {/* Verdict icon */}
        <VerdictIcon verdict={verdict} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{item.vendor || 'Unknown Vendor'}</span>
            {item.date && <span className="font-mono text-xs text-slate-400">{item.date}</span>}
          </div>
          {item.category && (
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block capitalize tracking-wide">{item.category}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono font-bold text-slate-800">${(item.amount||0).toFixed(2)}</span>
          <VerdictBadge verdict={verdict} />
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4 space-y-4 animate-in">

          {/* Override banner */}
          {item.override_verdict && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5 flex items-start gap-2">
              <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-indigo-700">
                  Overridden by {item.override_by}
                  {item.override_at && <span className="font-normal text-indigo-400 ml-1.5 font-mono">{new Date(item.override_at).toLocaleDateString()}</span>}
                </p>
                {item.override_comment && <p className="text-xs text-indigo-600 mt-0.5 italic">"{item.override_comment}"</p>}
              </div>
            </div>
          )}

          {/* Confidence */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Confidence</p>
            <ConfidenceBar value={item.confidence} />
          </div>

          {/* Reasoning */}
          {item.reasoning && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reasoning</p>
              <p className="text-sm text-slate-600 leading-relaxed">{item.reasoning}</p>
            </div>
          )}

          {/* Policy clauses */}
          {item.policy_clauses?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Policy Clauses Cited</p>
              <div className="space-y-2">
                {item.policy_clauses.map((c,i) => <PolicyClause key={i} clause={c} />)}
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => { setShowOverride(v => !v); setShowAudit(false) }} className="btn-secondary text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
              {showOverride ? 'Cancel' : 'Override Verdict'}
            </button>
            <button onClick={() => { loadAudit(); setShowOverride(false) }} className="btn-secondary text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              {showAudit ? 'Hide Trail' : 'Audit Trail'}
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger text-xs ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>

          {showOverride && <OverrideForm item={item} onSaved={u => { onUpdate(u); setShowOverride(false) }} onCancel={() => setShowOverride(false)} />}

          {showAudit && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 animate-in">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Audit Trail</p>
              <AuditTrail logs={auditLogs} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
