import { NavLink } from 'react-router-dom'

const LINK = 'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group'
const ACTIVE = 'bg-violet-50 text-violet-700 shadow-sm'
const INACTIVE = 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'

export default function Sidebar({ onNewSubmission }) {
  return (
    <aside className="w-56 h-screen flex flex-col shrink-0 bg-white border-r border-slate-200">

      {/* Logo + branding */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Logo mark — gradient shield */}
          <div className="relative w-9 h-9 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-brand">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            {/* AI sparkle dot */}
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-2 border-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-tight">Northwind</div>
            <div className="text-xs text-slate-400 leading-tight">Expense Review</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* New Submission CTA */}
        <button onClick={onNewSubmission}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 rounded-xl text-sm font-semibold
            bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-brand
            hover:shadow-lg hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Submission
        </button>

        <NavLink to="/" end className={({ isActive }) => `${LINK} ${isActive ? ACTIVE : INACTIVE}`}>
          {({ isActive }) => <>
            <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
            Submissions
          </>}
        </NavLink>

        <NavLink to="/policy" className={({ isActive }) => `${LINK} ${isActive ? ACTIVE : INACTIVE}`}>
          {({ isActive }) => <>
            <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
            </svg>
            Policy Q&A
          </>}
        </NavLink>

        <NavLink to="/employees" className={({ isActive }) => `${LINK} ${isActive ? ACTIVE : INACTIVE}`}>
          {({ isActive }) => <>
            <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            Employees
          </>}
        </NavLink>
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            NR
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-700 truncate">Northwind Reviewer</div>
            <div className="text-xs text-slate-400 truncate">devgoel10dg@gmail.com</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
