const ACTION = {
  override: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  delete:   { cls: 'bg-rose-50   text-rose-700   border-rose-200'   },
  create:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export default function AuditTrail({ logs }) {
  if (!logs || logs.length === 0)
    return <p className="text-sm text-slate-400 py-2 text-center">No audit records yet.</p>

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
          <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${ACTION[log.action]?.cls || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {log.action}
          </span>
          <div className="flex-1 min-w-0">
            {log.actor && <p className="text-xs font-semibold text-slate-700">{log.actor}</p>}
            {log.new_value?.comment && <p className="text-xs text-slate-500 mt-0.5 italic">"{log.new_value.comment}"</p>}
            {log.new_value?.verdict && <p className="text-xs text-slate-400 mt-0.5">→ {log.new_value.verdict}</p>}
          </div>
          <span className="font-mono text-xs text-slate-400 shrink-0">
            {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
