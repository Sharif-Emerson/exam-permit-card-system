import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'
import { Calendar, Clock, Download, LogOut, MapPin, Printer, RefreshCcw, Ticket, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchStudentProfileById } from '../services/profileService'
import type { StudentProfile } from '../types'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [studentData, setStudentData] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadStudentProfile() {
      if (!user || user.role !== 'student') {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const profile = await fetchStudentProfileById(user.id)
        setStudentData(profile)
      } catch (loadError) {
        const nextError = loadError instanceof Error ? loadError.message : 'Unable to load your permit'
        setError(nextError)
      } finally {
        setLoading(false)
      }
    }

    void loadStudentProfile()
  }, [user])

  async function handleRefresh() {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      setLoading(true)
      setError('')
      const profile = await fetchStudentProfileById(user.id)
      setStudentData(profile)
    } catch (refreshError) {
      const nextError = refreshError instanceof Error ? refreshError.message : 'Unable to refresh permit details'
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: studentData ? `Exam_Permit_${studentData.name.replace(/\s+/g, '_')}` : 'Exam_Permit',
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
        .print-break {
          page-break-before: always;
        }
      }
    `,
  })

  const handleDownload = () => {
    // Use the print functionality to trigger download dialog
    handlePrint()
  }

  const paymentPercentage = studentData
    ? Math.min((studentData.amountPaid / studentData.totalFees) * 100, 100)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading exam permit...</p>
        </div>
      </div>
    )
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-6 text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to load your permit</h2>
          <p className="text-sm text-slate-600 mb-4">{error || 'No student record was found for this account.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 bg-slate-200 text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center mb-4 no-print">
          <div>
            <p className="text-sm font-medium text-slate-500">Student Portal</p>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back, {studentData.name}</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div ref={printRef} className="permit-sheet bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 border border-slate-200">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8 border-b border-slate-200 pb-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Official Examination Access Card</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Exam Permit</h2>
            <p className="text-sm sm:text-base text-gray-600">University Examination System</p>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
              <img
                src={studentData.profileImage}
                alt="Profile"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
              />
              <div className="text-center sm:text-left">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{studentData.name}</h2>
                <p className="text-sm sm:text-base text-gray-600">{studentData.studentId}</p>
                <p className="text-sm sm:text-base text-gray-600">{studentData.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Course:</span>
                <span className="text-sm sm:text-base">{studentData.course}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm sm:text-base">Fees Balance:</span>
                <span className={`font-semibold text-sm sm:text-base ${studentData.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${studentData.feesBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Exam Details */}
          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Exam Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Date:</span>
                <span className="text-sm sm:text-base">{studentData.examDate}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Time:</span>
                <span className="text-sm sm:text-base">{studentData.examTime}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Venue:</span>
                <span className="text-sm sm:text-base">{studentData.venue}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Seat:</span>
                <span className="text-sm sm:text-base">{studentData.seatNumber}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <h4 className="font-semibold text-yellow-800 mb-2">Important Instructions</h4>
            <p className="text-yellow-700">{studentData.instructions}</p>
          </div>

          {/* Fees Status */}
          <div className={`rounded-lg p-3 sm:p-4 mb-6 sm:mb-8 border-2 ${studentData.feesBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <h4 className={`font-semibold mb-3 sm:mb-4 text-sm sm:text-base ${studentData.feesBalance > 0 ? 'text-red-800' : 'text-green-800'}`}>
              Fees Status
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="text-center">
                  <p className="text-gray-600">Total Fees</p>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">${studentData.totalFees.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Amount Paid</p>
                  <p className="font-bold text-green-600 text-sm sm:text-base">${studentData.amountPaid.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Remaining</p>
                  <p className={`font-bold text-sm sm:text-base ${studentData.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${studentData.feesBalance.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <progress
                  className={`payment-progress ${studentData.feesBalance > 0 ? 'payment-progress-danger' : 'payment-progress-clear'}`}
                  value={paymentPercentage}
                  max={100}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className={`text-xs sm:text-sm font-medium ${studentData.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {studentData.feesBalance > 0 ? 'Payment Required' : 'All Clear'}
                </span>
                <span className="text-xs sm:text-sm text-gray-600">
                  {paymentPercentage.toFixed(1)}% Paid
                </span>
              </div>
            </div>
            {studentData.feesBalance > 0 && (
              <p className="text-red-700 mt-3 text-xs sm:text-sm">
                Please settle your outstanding fees before the examination date to avoid any issues.
                <br />
                <strong>Note:</strong> Printing and downloading of exam permits are disabled until fees are fully cleared.
              </p>
            )}
            {studentData.feesBalance === 0 && (
              <p className="text-green-700 mt-3 text-xs sm:text-sm">
                All fees have been paid. You are eligible to take the examination.
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="text-center mb-8 print:mb-0">
            <h4 className="font-semibold text-gray-900 mb-4">Verification QR Code</h4>
            <div className="inline-flex p-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <QRCode value={JSON.stringify(studentData)} size={128} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 no-print">
            <button
              onClick={handlePrint}
              disabled={studentData.feesBalance > 0}
              className={`flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 sm:py-2 rounded-lg transition-colors text-sm sm:text-base ${
                studentData.feesBalance > 0
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={studentData.feesBalance > 0 ? 'Please clear all outstanding fees before printing' : ''}
            >
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Print Permit</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={studentData.feesBalance > 0}
              className={`flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 sm:py-2 rounded-lg transition-colors text-sm sm:text-base ${
                studentData.feesBalance > 0
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={studentData.feesBalance > 0 ? 'Please clear all outstanding fees before downloading' : ''}
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Download PDF</span>
            </button>
          </div>
          {studentData.feesBalance > 0 && (
            <div className="text-center mt-3 sm:mt-4">
              <p className="text-red-600 text-xs sm:text-sm font-medium">
                ⚠️ Printing and downloading are disabled until all fees are cleared
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}