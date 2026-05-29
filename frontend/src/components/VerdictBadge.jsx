export const VERDICT_CONFIG = {
  compliant: { label: 'Compliant', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  flagged:   { label: 'Flagged',   cls: 'bg-amber-500 text-white ring-amber-600 shadow-sm font-bold', dot: 'bg-white' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-50 text-rose-700 ring-rose-200',           dot: 'bg-rose-500'    },
}

// Normalize — needs_review and ambiguous both show as Flagged
function normalize(verdict) {
  if (verdict === 'needs_review' || verdict === 'ambiguous') return 'flagged'
  return verdict
}

export default function VerdictBadge({ verdict }) {
  const key = normalize(verdict)
  const cfg = VERDICT_CONFIG[key] || VERDICT_CONFIG.flagged
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ring-1 whitespace-nowrap font-mono ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
