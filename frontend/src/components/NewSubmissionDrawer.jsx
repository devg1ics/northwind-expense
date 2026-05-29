import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployees, createEmployee, createSubmission } from '../lib/api.js'

export default function NewSubmissionDrawer({ onClose }) {
  const navigate = useNavigate()
  const [employees,  setEmployees]  = useState([])
  const [selected,   setSelected]   = useState(null)
  const [showNewEmp, setShowNewEmp] = useState(false)
  const [empForm,    setEmpForm]    = useState({ name:'', grade:5, title:'', department:'', manager_name:'' })
  const [tripForm,   setTripForm]   = useState({ trip_purpose:'', trip_destination:'', trip_start:'', trip_end:'' })
  const [saving,     setSaving]     = useState(false)
  const [savingEmp,  setSavingEmp]  = useState(false)

  useEffect(() => { getEmployees().then(setEmployees).catch(()=>{}) }, [])

  const handleCreateEmployee = async () => {
    if (!empForm.name.trim()) return alert('Name is required')
    setSavingEmp(true)
    try {
      const emp = await createEmployee(empForm)
      setEmployees(prev => [...prev, emp])
      setSelected(emp)
      setShowNewEmp(false)
      setEmpForm({ name:'', grade:5, title:'', department:'', manager_name:'' })
    } catch(e) { alert('Failed: ' + (e.response?.data?.detail || e.message)) }
    finally { setSavingEmp(false) }
  }

  const handleSubmit = async () => {
    if (!selected) return alert('Select an employee')
    setSaving(true)
    try {
      const sub = await createSubmission({ ...tripForm, employee_id: selected.id })
      onClose()
      navigate(`/submissions/${sub.id}`)
    } catch(e) { alert('Failed: ' + (e.response?.data?.detail || e.message)) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl flex flex-col slide-right border-l border-slate-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">New Submission</h2>
            <p className="text-xs text-slate-400 mt-0.5">Create a trip expense submission</p>
          </div>
          <button onClick={onClose} className="btn-secondary p-2 rounded-lg" aria-label="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">1</div>
              <h3 className="text-sm font-semibold text-slate-800">Employee</h3>
            </div>

            <select value={selected?.id || ''} onChange={e => setSelected(employees.find(emp => String(emp.id) === e.target.value) || null)} className="select">
              <option value="">Choose employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.title || e.department || 'Grade '+e.grade}</option>)}
            </select>

            {/* Selected card */}
            {selected && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-center gap-3 animate-in">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900">{selected.name}</p>
                  <p className="text-xs text-violet-600">{selected.title} · {selected.department} · Grade {selected.grade}</p>
                </div>
              </div>
            )}

            {/* Toggle new employee */}
            <button onClick={() => setShowNewEmp(v => !v)} className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform ${showNewEmp ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {showNewEmp ? 'Cancel' : 'Create new employee'}
            </button>

            {showNewEmp && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-in">
                <div className="grid grid-cols-2 gap-3">
                  {[['name','Full Name','Jane Smith'],['title','Title','Senior Analyst'],['department','Department','Finance'],['manager_name','Manager','Manager name']].map(([k,l,p]) => (
                    <div key={k} className={k === 'manager_name' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                      <input value={empForm[k]} onChange={e => setEmpForm(f=>({...f,[k]:e.target.value}))} placeholder={p} className="input text-sm" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Grade (1–10)</label>
                    <input type="number" min="1" max="10" value={empForm.grade} onChange={e => setEmpForm(f=>({...f,grade:Number(e.target.value)}))} className="input text-sm" />
                  </div>
                </div>
                <button onClick={handleCreateEmployee} disabled={savingEmp} className="btn-primary text-xs w-full justify-center">
                  {savingEmp ? 'Creating…' : 'Add Employee'}
                </button>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">2</div>
              <h3 className="text-sm font-semibold text-slate-800">Trip Details</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Purpose</label>
              <input value={tripForm.trip_purpose} onChange={e => setTripForm(f=>({...f,trip_purpose:e.target.value}))} placeholder="Client meeting, conference, site visit…" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Destination</label>
              <input value={tripForm.trip_destination} onChange={e => setTripForm(f=>({...f,trip_destination:e.target.value}))} placeholder="Chicago, IL" className="input text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                <input type="date" value={tripForm.trip_start} onChange={e => setTripForm(f=>({...f,trip_start:e.target.value}))} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                <input type="date" value={tripForm.trip_end} onChange={e => setTripForm(f=>({...f,trip_end:e.target.value}))} className="input text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={handleSubmit} disabled={saving || !selected} className="btn-primary flex-1 justify-center">
            {saving ? 'Creating…' : 'Create & Upload Receipts →'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </>
  )
}
