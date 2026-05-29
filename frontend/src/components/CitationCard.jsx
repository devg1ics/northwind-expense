export default function CitationCard({ citation }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
          {citation.id}
        </span>
        {citation.title && <span className="text-xs text-slate-500 truncate">{citation.title}</span>}
      </div>
      {(citation.text || citation.quoted_text) && (
        <p className="text-xs text-slate-500 italic leading-relaxed">
          "{citation.text || citation.quoted_text}"
        </p>
      )}
    </div>
  )
}
