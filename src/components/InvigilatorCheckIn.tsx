import React, { useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'
// You may need to install 'react-qr-reader' or similar package for QR scanning
// import QrReader from 'react-qr-reader'

type InvigilatorPermitPayload = {
  name?: string
  student_id?: string
  course?: string
  semester?: string
  fees_balance?: number
  exams?: { examDate: string }[]
}

/** Accept raw token, full verify URL from QR, or compact `KIU-PERMIT|token|...` offline payload. */
function extractPermitTokenFromScanInput(raw: string): string {
  const t = raw.trim()
  if (!t) {
    return ''
  }
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      const fromPermits = u.pathname.match(/\/permits\/([^/?#]+)/i)
      if (fromPermits?.[1]) {
        return decodeURIComponent(fromPermits[1])
      }
      const segments = u.pathname.split('/').filter(Boolean)
      const last = segments[segments.length - 1]
      if (last) {
        return decodeURIComponent(last)
      }
    } catch {
      /* ignore malformed URL */
    }
  }
  if (t.toUpperCase().startsWith('KIU-PERMIT|')) {
    const parts = t.split('|')
    if (parts[1]?.trim()) {
      return parts[1].trim()
    }
  }
  return t
}

export default function InvigilatorCheckIn() {
  const [token, setToken] = useState('')
  const [permit, setPermit] = useState<InvigilatorPermitPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Uncomment and use this if you add a QR reader package
  // const handleScan = (data) => {
  //   if (data) {
  //     setToken(data)
  //     fetchPermit(data)
  //   }
  // }

  // const handleError = (err) => {
  //   setError('QR scan error: ' + err.message)
  // }

  const fetchPermit = async (permitToken: string) => {
    setLoading(true)
    setError('')
    setPermit(null)
    try {
      const res = await fetch(`/permits/${permitToken}`)
      if (!res.ok) throw new Error('Permit not found or invalid token')
      const data = (await res.json()) as InvigilatorPermitPayload
      setPermit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const extracted = extractPermitTokenFromScanInput(token)
    if (extracted) {
      void fetchPermit(extracted)
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      {error && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-100 px-5 py-4">
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
              <span className="flex-1 text-sm font-semibold text-red-700">Error</span>
              <button type="button" aria-label="Dismiss error" onClick={() => setError('')} className="rounded-full p-1 text-red-400 hover:bg-red-100 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="px-5 py-4 text-sm text-red-700">{error}</p>
            <div className="flex justify-end px-5 pb-4">
              <button type="button" onClick={() => setError('')} className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">OK</button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">Invigilator Permit Check-In</h1>
      {/* <QrReader delay={300} onError={handleError} onScan={handleScan} style={{ width: '100%' }} /> */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2"
          placeholder="Token, verify URL, or scanned text"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded">Verify</button>
      </form>
      {loading && <div className="text-blue-600">Checking permit...</div>}
      {permit && (
        <div className="mt-4 border rounded p-4 bg-slate-50">
          <h2 className="text-lg font-semibold mb-2">Permit Details</h2>
          <div><strong>Name:</strong> {permit.name}</div>
          <div><strong>Student ID:</strong> {permit.student_id}</div>
          <div><strong>Course:</strong> {permit.course}</div>
          <div><strong>Semester:</strong> {permit.semester}</div>
          <div><strong>Status:</strong> {permit.fees_balance === 0 ? 'Cleared' : 'Not Cleared'}</div>
          <div><strong>Valid Until:</strong> {permit.exams && permit.exams.length > 0 ? new Date(Math.max(...permit.exams.map((exam) => new Date(exam.examDate).getTime()))).toLocaleDateString() : 'N/A'}</div>
        </div>
      )}
      <div className="mt-6 text-xs text-slate-500">
        Student permits encode a short verification link when the server URL is configured; otherwise a compact code. Paste the raw scan result, the full URL, or only the permit token.
      </div>
    </div>
  )
}
