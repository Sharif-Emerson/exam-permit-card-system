import React, { useState } from 'react'
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
    if (token.trim()) fetchPermit(token.trim())
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Invigilator Permit Check-In</h1>
      {/* <QrReader delay={300} onError={handleError} onScan={handleScan} style={{ width: '100%' }} /> */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2"
          placeholder="Enter or scan permit token"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded">Verify</button>
      </form>
      {loading && <div className="text-blue-600">Checking permit...</div>}
      {error && <div className="text-red-600">{error}</div>}
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
      <div className="mt-6 text-xs text-slate-500">Scan the QR code on the student permit or enter the token manually to verify exam access.</div>
    </div>
  )
}
