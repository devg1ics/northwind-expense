import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function UploadZone({ onDrop }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(onDrop, [onDrop]),
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg','.jpeg','.png'], 'text/plain': ['.txt'] },
  })

  return (
    <div {...getRootProps()} className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 overflow-hidden
        ${isDragActive ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'}`}>
      <input {...getInputProps()} />

      {/* Decorative background dots */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, #6D28D9 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Upload SVG illustration */}
      <div className="relative">
        <div className={`mx-auto w-16 h-16 mb-3 transition-transform duration-200 ${isDragActive ? 'scale-110' : ''}`}>
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cloud body */}
            <path d="M48 38c3.31 0 6-2.69 6-6 0-3.17-2.46-5.77-5.57-5.98C47.72 20.73 43.24 17 38 17c-4.08 0-7.64 2.18-9.62 5.44C27.6 22.17 26.82 22 26 22c-4.42 0-8 3.58-8 8s3.58 8 8 8h22z"
              fill={isDragActive ? '#EDE9FE' : '#F1F5F9'}
              stroke={isDragActive ? '#7C3AED' : '#CBD5E1'} strokeWidth="1.5"/>
            {/* Arrow up */}
            <path d="M32 48v-14M26 38l6-6 6 6"
              stroke={isDragActive ? '#6D28D9' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {/* File types hint */}
            <rect x="10" y="46" width="12" height="14" rx="2" fill={isDragActive ? '#DDD6FE' : '#E2E8F0'}/>
            <rect x="26" y="48" width="12" height="12" rx="2" fill={isDragActive ? '#C4B5FD' : '#CBD5E1'}/>
            <rect x="42" y="46" width="12" height="14" rx="2" fill={isDragActive ? '#DDD6FE' : '#E2E8F0'}/>
          </svg>
        </div>
        <p className={`text-sm font-semibold transition-colors ${isDragActive ? 'text-violet-700' : 'text-slate-600'}`}>
          {isDragActive ? 'Drop your receipts here' : 'Upload receipts'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Drag & drop or click to browse · PDF, JPG, PNG, TXT
        </p>
      </div>
    </div>
  )
}
