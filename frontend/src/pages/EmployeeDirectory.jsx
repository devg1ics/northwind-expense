import { useState, useEffect } from 'react'
import { getEmployees } from '../lib/api.js'

const AVATAR_GRAD = [
  'from-violet-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
]

const GRADE_LABEL = {
  1: 'Associate', 2: 'Associate II', 3: 'Analyst', 4: 'Senior Analyst',
  5: 'Manager', 6: 'Senior Manager', 7: 'Director', 8: 'Senior Director',
  9: 'VP', 10: 'SVP / C-Suite',
}

function EmployeeCard({ emp }) {
  const grad = AVATAR_GRAD[emp.id % AVATAR_GRAD.length]
  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="card p-5 space-y-4 hover:shadow-lifted transition-all duration-200">
      {/* Top: avatar + name + grade */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-sm leading-tight">{emp.name}</h3>
          {emp.title && <p className="text-xs text-slate-500 mt-0.5">{emp.title}</p>}
          <span className="inline-block mt-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
            Grade {emp.grade}{GRADE_LABEL[emp.grade] ? ` · ${GRADE_LABEL[emp.grade]}` : ''}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Detail rows */}
      <div className="space-y-2">
        {emp.department && (
          <Row label="Department" value={emp.department} />
        )}
        {emp.manager_name && (
          <Row label="Manager" value={emp.manager_name} />
        )}
        {emp.home_base && (
          <Row label="Home Base" value={emp.home_base} />
        )}
        {emp.employee_id && (
          <Row label="Employee ID" value={emp.employee_id} mono />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24 shrink-0">{label}</span>
      <span className={`text-xs text-slate-600 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    getEmployees().then(setEmployees).finally(() => setLoading(false))
  }, [])

  const filtered = employees.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.name?.toLowerCase().includes(q)
      || e.title?.toLowerCase().includes(q)
      || e.department?.toLowerCase().includes(q)
  })

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 px-6 py-6 text-white shadow-lifted">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute top-4 right-24 w-20 h-20 bg-white/5 rounded-full" />
        <div className="absolute right-6 bottom-0 opacity-20">
          <svg viewBox="0 0 80 80" fill="none" className="w-20 h-20">
            <circle cx="28" cy="24" r="14" fill="white"/>
            <path d="M4 68 C4 52 52 52 52 68" fill="white"/>
            <circle cx="58" cy="22" r="10" fill="white" opacity="0.6"/>
            <path d="M40 68 C40 56 76 56 76 68" fill="white" opacity="0.6"/>
          </svg>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Northwind Logistics</p>
          <h1 className="text-2xl font-bold leading-tight">Employee Directory</h1>
          <p className="text-sm text-white/70 mt-1">
            {loading ? 'Loading…' : `${employees.length} employee${employees.length !== 1 ? 's' : ''} on record`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, title, department…"
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

      {/* Result count */}
      {!loading && (
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-slate-600">{filtered.length}</span> employee{filtered.length !== 1 ? 's' : ''}
          {search && <span className="text-violet-600 ml-1">matching "{search}"</span>}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 space-y-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
              <div className="border-t border-slate-100" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <svg viewBox="0 0 160 120" fill="none" className="w-36 h-28 mx-auto mb-4">
            <circle cx="60" cy="45" r="22" fill="#E2E8F0"/>
            <path d="M20 100 C20 76 100 76 100 100" fill="#E2E8F0"/>
            <circle cx="110" cy="42" r="16" fill="#F1F5F9"/>
            <path d="M76 100 C76 80 144 80 144 100" fill="#F1F5F9"/>
          </svg>
          <p className="text-slate-600 font-semibold">No employees found</p>
          <p className="text-slate-400 text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} />
          ))}
        </div>
      )}
    </div>
  )
}
