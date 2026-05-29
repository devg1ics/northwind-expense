import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteSubmission } from '../lib/api.js'

const STATUS = {
  pending:  { cls: 'bg-amber-400 text-white ring-amber-500 shadow-sm', dot: 'bg-white',        border: 'border-l-4 border-l-amber-400'   },
  reviewed: { cls: 'bg-blue-50 text-blue-700 ring-blue-200',           dot: 'bg-blue-400',     border: 'border-l-4 border-l-blue-400'    },
  approved: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200',  dot: 'bg-emerald-400',  border: 'border-l-4 border-l-emerald-500' },
  rejected: { cls: 'bg-rose-50 text-rose-700 ring-rose-200',           dot: 'bg-rose-400',     border: 'border-l-4 border-l-rose-500'    },
}

const AVATAR_GRAD = [
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
]

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">{label}</span>
      <span className="text-sm text-slate-600">{value}</span>
    </div>
  )
}

export default function SubmissionRow({ sub, onDeleted }) {
  const navigate   = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const statusCfg  = STATUS[sub.status] || { cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' }
  const grad       = AVATAR_GRAD[(sub.employee_id || 0) % AVATAR_GRAD.length]

  const handleDelete = async (e) => {
    e.stopPropagation()
    const name = sub.employee?.name || 'this trip'
    const dest = sub.trip_destination ? ` to ${sub.trip_destination}` : ''
    if (!confirm(`Delete ${name}'s submission${dest}?\n\nThis will remove all receipts and audit logs and cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteSubmission(sub.id)
      onDeleted(sub.id)
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.detail || e.message))
      setDeleting(false)
    }
  }

  const dateRange = [sub.trip_start, sub.trip_end].filter(Boolean).join(' → ')

  return (
    <div
      onClick={() => navigate(`/submissions/${sub.id}`)}
      className="card card-hover px-5 py-4 cursor-pointer transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">

        {/* Avatar */}
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-base font-bold text-white shrink-0 shadow-sm mt-0.5`}>
          {sub.employee?.name?.charAt(0) || '?'}
        </div>

        {/* Main content — vertical stack */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Row 1: Name + title + status + flagged */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-base">{sub.employee?.name}</span>
            {sub.employee?.title && (
              <span className="text-sm text-slate-400 font-normal">{sub.employee.title}</span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 font-mono ${statusCfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {sub.status}
            </span>
            {sub.flagged_count > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                {sub.flagged_count} flagged
              </span>
            )}
          </div>

          {/* Row 2: Divider */}
          <div className="border-t border-slate-100" />

          {/* Rows 3–5: Labeled detail lines */}
          <div className="space-y-1.5">
            <DetailRow label="Purpose"     value={sub.trip_purpose} />
            <DetailRow label="Destination" value={sub.trip_destination} />
            <DetailRow label="Dates"       value={dateRange || null} />
            {sub.receipt_count > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">Receipts</span>
                <span className="text-sm text-slate-600">{sub.receipt_count} receipt{sub.receipt_count !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right column: amount + date + delete + chevron */}
        <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
          <div className="text-right">
            <div className="font-mono font-bold text-slate-900 text-lg">${(sub.total_amount || 0).toFixed(2)}</div>
            <div className="font-mono text-xs text-slate-400 mt-0.5">
              {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Delete button — visible on hover */}
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete submission"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-400 hover:text-rose-600 border border-rose-200 disabled:opacity-40"
            >
              {deleting ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              )}
            </button>

            <svg className="w-4 h-4 text-slate-300 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>

      </div>
    </div>
  )
}
