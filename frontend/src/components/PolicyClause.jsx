export default function PolicyClause({ clause }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
          {clause.id}
        </span>
        {clause.title && <span className="text-xs text-slate-600 font-medium">{clause.title}</span>}
      </div>
      {clause.quoted_text && (
        <blockquote className="text-xs text-slate-600 border-l-2 border-violet-300 pl-2.5 italic leading-relaxed">
          "{clause.quoted_text}"
        </blockquote>
      )}
      {clause.relevance && <p className="text-xs text-slate-500">{clause.relevance}</p>}
    </div>
  )
}
