export default function ConfidenceBar({ value }) {
  const pct   = Math.round((value || 0) * 100)
  const high  = value >= 0.80
  const med   = value >= 0.55
  const color = high ? 'bg-emerald-500' : med ? 'bg-amber-500' : 'bg-rose-500'
  const label = high ? 'text-emerald-700' : med ? 'text-amber-700' : 'text-rose-700'
  const track = high ? 'bg-emerald-100'  : med ? 'bg-amber-100'  : 'bg-rose-100'

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 h-2 ${track} rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-xs font-semibold w-9 text-right ${label}`}>{pct}%</span>
    </div>
  )
}
