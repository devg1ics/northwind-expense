import { useState, useEffect, useCallback } from 'react'
import { getSubmissions, getEmployees } from '../lib/api.js'
import StatCard from '../components/StatCard.jsx'
import SubmissionRow from '../components/SubmissionRow.jsx'

const IconTotal = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
  </svg>
)
const IconPending = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
  </svg>
)
const IconFlagged = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
)

const TABS = [
  { key: 'pending',  label: 'Pending',  dot: 'bg-amber-400',   active: 'border-amber-500 text-amber-700',   inactive: 'text-slate-500' },
  { key: 'reviewed', label: 'Reviewed', dot: 'bg-blue-400',    active: 'border-blue-500 text-blue-700',     inactive: 'text-slate-500' },
  { key: 'approved', label: 'Approved', dot: 'bg-emerald-500', active: 'border-emerald-600 text-emerald-700', inactive: 'text-slate-500' },
  { key: 'rejected', label: 'Rejected', dot: 'bg-rose-500',    active: 'border-rose-500 text-rose-700',     inactive: 'text-slate-500' },
]

function EmptyState({ tab }) {
  const messages = {
    pending:  { title: 'No pending submissions', sub: 'All caught up — nothing waiting for review.' },
    reviewed: { title: 'No reviewed submissions', sub: 'Reviewed submissions will appear here.' },
    approved: { title: 'No approved submissions', sub: 'Approved submissions will appear here.' },
    rejected: { title: 'No rejected submissions', sub: 'Rejected submissions will appear here.' },
  }
  const m = messages[tab] || messages.pending
  return (
    <div className="text-center py-16">
      <svg viewBox="0 0 160 120" fill="none" className="w-36 h-28 mx-auto mb-4">
        <ellipse cx="80" cy="108" rx="55" ry="8" fill="#F1F5F9"/>
        <rect x="35" y="55" width="90" height="55" rx="6" fill="#E2E8F0"/>
        <rect x="40" y="46" width="80" height="55" rx="6" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5"/>
        <rect x="45" y="38" width="70" height="55" rx="6" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
        <rect x="55" y="50" width="40" height="4" rx="2" fill="#CBD5E1"/>
        <rect x="55" y="58" width="28" height="3" rx="1.5" fill="#E2E8F0"/>
        <rect x="55" y="65" width="34" height="3" rx="1.5" fill="#E2E8F0"/>
        <path d="M118 22 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5-4 l-4-1.5 l4-1.5z" fill="#6D28D9" opacity="0.25"/>
      </svg>
      <p className="text-slate-600 font-semibold">{m.title}</p>
      <p className="text-slate-400 text-sm mt-1">{m.sub}</p>
    </div>
  )
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-violet-900 ml-0.5 leading-none">×</button>
    </span>
  )
}

export default function HomePage() {
  const [submissions, setSubmissions] = useState([])
  const [employees,   setEmployees]   = useState([])
  const [fetching,    setFetching]    = useState(true)
  const [activeTab,     setActiveTab]     = useState('pending')
  const [search,        setSearch]        = useState('')
  const [empFilter,     setEmpFilter]     = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')

  const fetchSubmissions = useCallback(() => {
    setFetching(true)
    getSubmissions({
      employee_id: empFilter || undefined,
      date_from:   dateFrom  || undefined,
      date_to:     dateTo    || undefined,
    }).then(setSubmissions).finally(() => setFetching(false))
  }, [empFilter, dateFrom, dateTo])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])
  useEffect(() => { getEmployees().then(setEmployees) }, [])

  // Counts per tab (before text search)
  const counts = {
    pending:  submissions.filter(s => s.status === 'pending').length,
    reviewed: submissions.filter(s => s.status === 'reviewed').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }

  const totalFlagged = submissions.reduce((a, s) => a + (s.flagged_count || 0), 0)

  // Step 1: apply search + employee + date — always across ALL statuses
  const preFiltered = submissions.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const matchSearch = s.employee?.name?.toLowerCase().includes(q)
        || s.trip_purpose?.toLowerCase().includes(q)
        || s.trip_destination?.toLowerCase().includes(q)
      if (!matchSearch) return false
    }
    return true
  })

  // Step 2: tab counts from pre-filtered set (update live as you type)
  const filteredCounts = {
    pending:  preFiltered.filter(s => s.status === 'pending').length,
    reviewed: preFiltered.filter(s => s.status === 'reviewed').length,
    approved: preFiltered.filter(s => s.status === 'approved').length,
    rejected: preFiltered.filter(s => s.status === 'rejected').length,
  }

  // Step 3: if searching, show everything regardless of tab/status; otherwise filter by status
  const activeStatus = statusFilter || activeTab
  const visible = search
    ? preFiltered
    : preFiltered.filter(s => s.status === activeStatus)

  // Sync tab highlight with dropdown selection
  const displayTab = statusFilter || activeTab

  const activeFilters = [empFilter, statusFilter, dateFrom, dateTo].filter(Boolean).length
  const clearFilters  = () => { setEmpFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setSearch('') }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-5">

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 px-6 py-6 text-white shadow-lifted">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute top-4 right-24 w-20 h-20 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 right-40 w-28 h-28 bg-white/8 rounded-full" />
        <div className="absolute right-6 bottom-0 opacity-20">
          <svg viewBox="0 0 80 90" fill="none" className="w-20 h-24">
            <path d="M40 5 L72 18 L72 45 C72 65 57 80 40 85 C23 80 8 65 8 45 L8 18 Z" fill="white"/>
            <path d="M26 44 L36 54 L55 33" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">AI-Powered</p>
          <h1 className="text-2xl font-bold leading-tight">Expense Review</h1>
          <p className="text-sm text-white/70 mt-1">
            {fetching ? 'Loading…' : `${submissions.length} total · ${counts.pending} pending review`}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Submissions" value={submissions.length} icon={IconTotal}   accent="violet"  loading={fetching} />
        <StatCard label="Pending Review"    value={counts.pending}     icon={IconPending} accent="amber"   loading={fetching} />
        <StatCard label="Flagged Items"     value={totalFlagged}       icon={IconFlagged} accent="rose"    loading={fetching} />
      </div>

      {/* Filter card — search + employee + date all together */}
      <div className="card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee, purpose, destination…"
            className="input pl-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Employee + status + date */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Employee</label>
            <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} className="select text-sm">
              <option value="">All employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); if (e.target.value) setActiveTab(e.target.value) }}
              className="select text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm" />
          </div>
        </div>

        {activeFilters > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {empFilter    && <Chip label={employees.find(e => String(e.id) === String(empFilter))?.name || 'Employee'} onRemove={() => setEmpFilter('')} />}
            {statusFilter && <Chip label={statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} onRemove={() => setStatusFilter('')} />}
            {dateFrom     && <Chip label={`From ${dateFrom}`} onRemove={() => setDateFrom('')} />}
            {dateTo       && <Chip label={`To ${dateTo}`}     onRemove={() => setDateTo('')} />}
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-violet-600 underline transition-colors ml-1">Clear all</button>
          </div>
        )}

      </div>

      {/* Status tabs — hidden while searching */}
      {!search && <div className="border-b border-slate-200">
        <div className="flex w-full">
          {TABS.map(tab => {
            const isActive = displayTab === tab.key
            const count    = filteredCounts[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setStatusFilter('') }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer
                  ${isActive ? `${tab.active}` : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
                {tab.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                  ${tab.key === 'pending' && count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}
                `}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>}

      {/* Result count */}
      {!fetching && (
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-slate-600">{visible.length}</span> {search ? '' : activeStatus + ' '}submission{visible.length !== 1 ? 's' : ''}
          {search && <span className="text-violet-600 ml-1">· search: "{search}"</span>}
        </p>
      )}

      {/* List */}
      {fetching ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card px-5 py-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                  <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-2">
          {visible.map(sub => (
            <SubmissionRow
              key={sub.id}
              sub={sub}
              onDeleted={id => setSubmissions(prev => prev.filter(s => s.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
