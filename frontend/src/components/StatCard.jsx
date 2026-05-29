const ACCENT = {
  violet: { grad: 'from-violet-500 to-indigo-500', bg: 'bg-violet-50', ring: 'ring-violet-100', text: 'text-violet-700', num: 'text-violet-900' },
  amber:  { grad: 'from-amber-400  to-orange-500',  bg: 'bg-amber-50',  ring: 'ring-amber-100',  text: 'text-amber-700',  num: 'text-amber-900'  },
  rose:   { grad: 'from-rose-500   to-pink-500',    bg: 'bg-rose-50',   ring: 'ring-rose-100',   text: 'text-rose-700',   num: 'text-rose-900'   },
  emerald:{ grad: 'from-emerald-500 to-teal-500',  bg: 'bg-emerald-50',ring: 'ring-emerald-100',text: 'text-emerald-700',num: 'text-emerald-900'},
}

export default function StatCard({ label, value, icon, accent = 'violet', loading = false }) {
  const a = ACCENT[accent] || ACCENT.violet
  return (
    <div className="card px-5 py-4 flex items-center gap-4 min-w-[140px]">
      {/* Gradient icon box */}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-sm shrink-0`}>
        <span className="text-white w-5 h-5">{icon}</span>
      </div>
      <div>
        {loading
          ? <div className="h-7 w-10 bg-slate-100 rounded animate-pulse mb-1" />
          : <div className={`text-2xl font-bold font-mono ${a.num}`}>{value}</div>
        }
        <div className="text-xs text-slate-500 font-medium">{label}</div>
      </div>
    </div>
  )
}
