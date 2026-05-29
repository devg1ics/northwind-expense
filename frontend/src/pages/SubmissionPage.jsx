import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSubmission, getSubmissionItems, uploadReceipt, updateSubmission } from '../lib/api.js'
import LineItemCard from '../components/LineItemCard.jsx'
import UploadZone from '../components/UploadZone.jsx'

const PRIORITY = ['rejected','flagged','needs_review','ambiguous']
const sortItems = items => [...items].sort((a,b) => {
  const va = a.override_verdict||a.verdict, vb = b.override_verdict||b.verdict
  return (PRIORITY.includes(va)?0:1) - (PRIORITY.includes(vb)?0:1)
})

const STATUS_CFG = {
  pending:  { cls:'bg-amber-400 text-white ring-amber-500 shadow-sm', dot:'bg-white', label:'Pending' },
  reviewed: { cls:'bg-blue-50 text-blue-700 ring-blue-200',      dot:'bg-blue-400',    label:'Reviewed' },
  approved: { cls:'bg-emerald-50 text-emerald-700 ring-emerald-200', dot:'bg-emerald-400', label:'Approved' },
  rejected: { cls:'bg-rose-50 text-rose-700 ring-rose-200',      dot:'bg-rose-400',    label:'Rejected' },
}

const UPLOAD_STATES = {
  uploading: { color:'bg-amber-400', pulse:true,  text:'Uploading…' },
  analyzing: { color:'bg-violet-500', pulse:true, text:'Extracting & analysing with AI…' },
  done:      { color:'bg-emerald-500',pulse:false, text:'✓ Verdict ready' },
  error:     { color:'bg-rose-500',   pulse:false, text:null },
}

export default function SubmissionPage() {
  const { id } = useParams(); const navigate = useNavigate()
  const [submission, setSubmission] = useState(null)
  const [items,      setItems]      = useState([])
  const [uploads,    setUploads]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [marking,    setMarking]    = useState(false)

  useEffect(() => {
    Promise.all([getSubmission(id), getSubmissionItems(id)])
      .then(([sub,its]) => { setSubmission(sub); setItems(sortItems(its)) })
      .finally(() => setLoading(false))
  }, [id])

  const onDrop = useCallback(async (files) => {
    for (const file of files) {
      const uid = Date.now() + Math.random()
      setUploads(p => [...p, { id:uid, name:file.name, status:'uploading' }])
      try {
        setUploads(p => p.map(u => u.id===uid ? {...u, status:'analyzing'} : u))
        const item = await uploadReceipt(id, file)
        setItems(p => sortItems([...p, item]))
        setSubmission(p => p ? {...p, total_amount: p.total_amount+(item.amount||0)} : p)
        setUploads(p => p.map(u => u.id===uid ? {...u, status:'done'} : u))
        setTimeout(() => setUploads(p => p.filter(u => u.id!==uid)), 3000)
      } catch(e) {
        setUploads(p => p.map(u => u.id===uid ? {...u, status:'error', error:e.response?.data?.detail||e.message} : u))
      }
    }
  }, [id])

  const handleItemUpdate = updated => setItems(p => sortItems(p.map(i => i.id===updated.id ? updated : i)))
  const handleItemDelete = itemId => {
    setItems(p => { const d=p.find(i=>i.id===itemId); if(d) setSubmission(prev=>prev?{...prev,total_amount:Math.max(0,prev.total_amount-(d.amount||0))}:prev); return p.filter(i=>i.id!==itemId) })
  }

  const handleStatusChange = async (newStatus) => {
    setMarking(true)
    try { const u = await updateSubmission(id, { status: newStatus }); setSubmission(u) }
    catch(e) { alert('Failed: ' + (e.response?.data?.detail || e.message)) }
    finally { setMarking(false) }
  }

  if (loading) return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-28" />
      <div className="card h-44 rounded-2xl" />
      <div className="card h-28 rounded-2xl" />
    </div>
  )
  if (!submission) return <div className="flex h-full items-center justify-center text-slate-400">Submission not found</div>

  const compliantCount = items.filter(i=>(i.override_verdict||i.verdict)==='compliant').length
  const flaggedCount   = items.filter(i=>['flagged','rejected','needs_review','ambiguous'].includes(i.override_verdict||i.verdict)).length
  const sCfg = STATUS_CFG[submission.status] || STATUS_CFG.pending

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-5">

      {/* Back */}
      <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        All submissions
      </button>

      {/* Header card — same structure as SubmissionRow */}
      <div className="card-raised rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
        <div className="px-5 py-4 flex items-start gap-4">

          {/* Avatar */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base font-bold text-white shadow-brand shrink-0 mt-0.5">
            {submission.employee?.name?.charAt(0)}
          </div>

          {/* Info — vertical stack matching row layout */}
          <div className="flex-1 min-w-0 space-y-2">

            {/* Row 1: Name + title + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-slate-900 text-base">{submission.employee?.name}</h1>
              {submission.employee?.title && (
                <span className="text-sm text-slate-400">{submission.employee.title}</span>
              )}
              {submission.employee?.department && (
                <span className="text-sm text-slate-400">· {submission.employee.department}</span>
              )}
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 font-mono ${sCfg.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />{sCfg.label}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Rows: labeled detail lines */}
            <div className="space-y-1.5">
              {submission.trip_purpose && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">Purpose</span>
                  <span className="text-sm text-slate-600">{submission.trip_purpose}</span>
                </div>
              )}
              {submission.trip_destination && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">Destination</span>
                  <span className="text-sm text-slate-600">{submission.trip_destination}</span>
                </div>
              )}
              {(submission.trip_start || submission.trip_end) && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">Dates</span>
                  <span className="text-sm font-mono text-slate-600">{submission.trip_start} → {submission.trip_end}</span>
                </div>
              )}
              {items.length > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">Receipts</span>
                  <span className="text-sm text-slate-600">{items.length} receipt{items.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Summary pills */}
            {items.length > 0 && (compliantCount > 0 || flaggedCount > 0) && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {compliantCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{compliantCount} compliant
                  </span>
                )}
                {flaggedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    {flaggedCount} need attention
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: amount + receipts + action */}
          <div className="flex flex-col items-end gap-2 shrink-0 ml-2">
            <div className="text-right">
              <div className="font-mono font-bold text-slate-900 text-2xl">${(submission.total_amount || 0).toFixed(2)}</div>
              <div className="font-mono text-xs text-slate-400 mt-0.5">
                {new Date(submission.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            {/* Action buttons based on current status */}
            {submission.status === 'pending' && (
              <button onClick={() => handleStatusChange('reviewed')} disabled={marking} className="btn-primary text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                {marking ? 'Saving…' : 'Mark as Reviewed'}
              </button>
            )}
            {submission.status === 'reviewed' && (
              <div className="flex flex-col gap-2">
                <button onClick={() => handleStatusChange('approved')} disabled={marking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {marking ? 'Saving…' : 'Approve'}
                </button>
                <button onClick={() => handleStatusChange('rejected')} disabled={marking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  {marking ? 'Saving…' : 'Reject'}
                </button>
              </div>
            )}
            {submission.status === 'approved' && (
              <div className="flex flex-col gap-2 items-end">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Approved
                </span>
                <button onClick={() => handleStatusChange('reviewed')} disabled={marking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 border border-slate-200 transition-all disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  </svg>
                  {marking ? 'Saving…' : 'Undo Approval'}
                </button>
              </div>
            )}
            {submission.status === 'rejected' && (
              <div className="flex flex-col gap-2 items-end">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  Rejected
                </span>
                <button onClick={() => handleStatusChange('reviewed')} disabled={marking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 border border-slate-200 transition-all disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  </svg>
                  {marking ? 'Saving…' : 'Undo Rejection'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Upload zone */}
      <UploadZone onDrop={onDrop} />

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map(u => {
            const cfg = UPLOAD_STATES[u.status] || UPLOAD_STATES.uploading
            return (
              <div key={u.id} className="card flex items-center gap-3 px-4 py-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.color} ${cfg.pulse?'animate-pulse':''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{u.status==='error' ? `✗ ${u.error}` : cfg.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Line items */}
      {items.length === 0 ? (
        <div className="text-center py-14">
          {/* Receipt illustration */}
          <svg viewBox="0 0 120 100" fill="none" className="w-28 h-24 mx-auto mb-3">
            <rect x="25" y="10" width="70" height="80" rx="5" fill="white" stroke="#E2E8F0" strokeWidth="2"/>
            <path d="M25 20 L95 20" stroke="#F1F5F9" strokeWidth="1.5"/>
            <rect x="35" y="30" width="50" height="4" rx="2" fill="#E2E8F0"/>
            <rect x="35" y="38" width="35" height="3" rx="1.5" fill="#F1F5F9"/>
            <rect x="35" y="48" width="42" height="3" rx="1.5" fill="#F1F5F9"/>
            <rect x="35" y="58" width="30" height="3" rx="1.5" fill="#F1F5F9"/>
            <path d="M35 68 L85 68" stroke="#E2E8F0" strokeDasharray="4 2"/>
            <rect x="60" y="74" width="25" height="5" rx="2" fill="#EDE9FE"/>
            {/* Plus icon */}
            <circle cx="85" cy="25" r="10" fill="#6D28D9"/>
            <path d="M85 20 L85 30 M80 25 L90 25" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-slate-600 font-semibold">No receipts yet</p>
          <p className="text-slate-400 text-sm mt-1">Upload receipts above to begin AI compliance review</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Line Items · {items.length} receipt{items.length!==1?'s':''}
          </p>
          {items.map(item => (
            <LineItemCard key={item.id} item={item} onUpdate={handleItemUpdate} onDelete={handleItemDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
