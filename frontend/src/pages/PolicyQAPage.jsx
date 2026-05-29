import { useState, useRef, useEffect } from 'react'
import { askPolicy } from '../lib/api.js'
import CitationCard from '../components/CitationCard.jsx'

const SUGGESTED = [
  'What is the meal per diem limit for domestic travel?',
  'Is alcohol reimbursable as a business expense?',
  'What receipts are required for lodging claims?',
  'What are the spending limits for Grade 5 employees?',
]

/* AI-branded avatar */
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-brand mt-0.5">
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    </div>
  )
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
      R
    </div>
  )
}

/* Empty state illustration */
function PolicyIllustration({ onAsk }) {
  return (
    <div className="text-center py-10 px-6 max-w-md mx-auto">
      <svg viewBox="0 0 180 140" fill="none" className="w-44 h-36 mx-auto mb-5">
        {/* Document stack */}
        <rect x="30" y="30" width="75" height="95" rx="6" fill="#E2E8F0" transform="rotate(-6 30 30)"/>
        <rect x="36" y="22" width="75" height="95" rx="6" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1.5" transform="rotate(-2 36 22)"/>
        <rect x="40" y="18" width="75" height="95" rx="6" fill="white" stroke="#E2E8F0" strokeWidth="1.5"/>
        {/* Lines */}
        <rect x="52" y="32" width="50" height="4" rx="2" fill="#CBD5E1"/>
        <rect x="52" y="40" width="38" height="3" rx="1.5" fill="#E2E8F0"/>
        <rect x="52" y="47" width="44" height="3" rx="1.5" fill="#E2E8F0"/>
        <rect x="52" y="54" width="32" height="3" rx="1.5" fill="#E2E8F0"/>
        <rect x="52" y="61" width="40" height="3" rx="1.5" fill="#E2E8F0"/>
        {/* Policy badge */}
        <rect x="52" y="72" width="28" height="14" rx="4" fill="#EDE9FE"/>
        <rect x="84" y="72" width="24" height="14" rx="4" fill="#DDD6FE"/>
        {/* Chat bubble */}
        <path d="M108 50 Q130 46 134 62 Q138 78 118 84 L110 90 L112 82 Q96 80 100 62 Q102 52 108 50Z" fill="#6D28D9" opacity="0.12"/>
        <path d="M115 59 L128 59 M115 65 L124 65 M115 71 L122 71" stroke="#6D28D9" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        {/* Sparkle */}
        <path d="M148 28 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5-4 l-4-1.5 l4-1.5z" fill="#F59E0B" opacity="0.5"/>
      </svg>
      <h3 className="text-base font-bold text-slate-800 mb-1">Ask the Policy Assistant</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">
        Get instant, policy-grounded answers about expense rules, limits, and approvals. Every answer cites the exact policy document.
      </p>

      {/* Suggested questions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Try asking</p>
        {SUGGESTED.map((q,i) => (
          <button key={i} onClick={() => onAsk(q)}
            className="w-full text-left text-sm px-4 py-2.5 card card-hover rounded-xl text-slate-600 hover:text-violet-700 transition-all duration-150 cursor-pointer flex items-center gap-2.5">
            <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PolicyQAPage() {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef  = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  const send = async (question) => {
    const q = (question || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(p => [...p, { role:'user', text:q }])
    setLoading(true)
    try {
      const result = await askPolicy(q)
      setMessages(p => [...p, { role:'assistant', ...result }])
    } catch(e) {
      setMessages(p => [...p, { role:'assistant', answer:'Error: '+e.message, citations:[], refused:false, out_of_scope:false }])
    } finally { setLoading(false) }
  }

  const handleChipClick = e => {
    const q = e.currentTarget.dataset.question
    if (q) send(q)
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-brand">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Policy Q&A</h1>
            <p className="text-xs text-slate-400">Grounded in Northwind expense policy documents</p>
          </div>
          {/* AI badge */}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full ring-1 ring-violet-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            AI Powered
          </span>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60">
        {messages.length === 0 ? (
          <PolicyIllustration onAsk={send} />
        ) : (
          <div className="px-6 py-5 space-y-5 max-w-3xl mx-auto">
            {messages.map((msg,i) => (
              <div key={i} className={`flex gap-3 ${msg.role==='user' ? 'justify-end' : 'justify-start'} fade-in`}>
                {msg.role === 'assistant' && <AIAvatar />}
                <div className={`max-w-xl flex flex-col gap-2 ${msg.role==='user'?'items-end':''}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-brand">
                      {msg.text}
                    </div>
                  ) : msg.refused || msg.out_of_scope ? (
                    <div className="card rounded-2xl rounded-tl-sm px-4 py-3 border-amber-200 bg-amber-50">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Outside policy scope</span>
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed">{msg.answer}</p>
                    </div>
                  ) : (
                    <div className="card rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{msg.answer}</p>
                    </div>
                  )}

                  {msg.citations?.length > 0 && (
                    <div className="space-y-1.5 w-full">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1">Policy Sources</p>
                      {msg.citations.map((c,ci) => <CitationCard key={ci} citation={c} />)}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && <UserAvatar />}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start fade-in">
                <AIAvatar />
                <div className="card rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0,120,240].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2 card p-2 shadow-lifted">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about expense policy… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={loading}
            className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-1 text-slate-700 placeholder-slate-400 font-sans"
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
