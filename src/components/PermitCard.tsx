import { Calendar, Clock, Download, LogOut, MapPin, Printer, RefreshCcw, Ticket, User } from 'lucide-react'
import type { StudentProfile } from '../types'
import BrandMark from './BrandMark'

export const FALLBACK_PROFILE_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="%23e2e8f0"/><circle cx="80" cy="58" r="28" fill="%2394a3b8"/><path d="M36 132c8-24 28-36 44-36s36 12 44 36" fill="%2394a3b8"/></svg>'

type PermitCardProps = {
  studentData: StudentProfile
  qrCodeUrl: string
  onRefresh: () => void
  onSignOut: () => void
  onPrint: () => void
  onDownload: () => void
}

export default function PermitCard({ studentData, qrCodeUrl, onRefresh, onSignOut, onPrint, onDownload }: PermitCardProps) {
  const paymentPercentage = studentData.totalFees > 0
    ? Math.min((studentData.amountPaid / studentData.totalFees) * 100, 100)
    : studentData.amountPaid > 0 ? 100 : 0

  const profileImage = studentData.profileImage?.trim() ? studentData.profileImage : FALLBACK_PROFILE_IMAGE

  return (
    <div className="min-h-screen bg-slate-100 py-4 sm:py-8 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center mb-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back, {studentData.name}</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="permit-sheet bg-amber-50 rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 border border-amber-200">
          <div className="text-center mb-6 sm:mb-8 border-b border-slate-200 pb-5 print:hidden">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Official Examination Access Card</p>
            <BrandMark
              align="center"
              titleClassName="text-2xl sm:text-3xl font-bold text-gray-900"
              subtitleClassName="text-sm sm:text-base text-gray-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 sm:gap-8 mb-6 sm:mb-8 print:grid-cols-1 print:gap-3 print:mb-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 print:flex-row print:items-center print:justify-center print:space-y-0 print:space-x-3">
              <img
                src={profileImage}
                alt="Profile"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover print:w-14 print:h-14"
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                }}
              />
              <div className="text-center sm:text-left print:text-left">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 print:text-base">{studentData.name}</h2>
                <p className="text-sm sm:text-base text-gray-600 print:hidden">{studentData.studentId}</p>
                <p className="text-sm sm:text-base text-gray-600 print:hidden">{studentData.email}</p>
              </div>
            </div>

            <div className="space-y-2 print:hidden">
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

          <div className="hidden print:flex print:items-center print:justify-center print:mb-4">
            <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${studentData.feesBalance === 0 ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}>
              Cleared Status: {studentData.feesBalance === 0 ? 'Cleared' : 'Not Cleared'}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 print:bg-transparent print:p-0">
            <div className="flex items-center justify-between gap-4 mb-4 print:hidden">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Assigned Exams</h3>
              <span className="text-xs sm:text-sm text-slate-500">{studentData.exams.length} scheduled</span>
            </div>
            {studentData.exams.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 print:gap-2">
                {studentData.exams.map((exam) => (
                  <div key={exam.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-lg print:p-3 print:shadow-none">
                    <h4 className="text-sm sm:text-base font-semibold text-slate-900 mb-3 print:text-sm print:mb-2">{exam.title}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 print:gap-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 print:hidden" />
                        <span className="font-medium text-sm sm:text-base print:text-xs">Date:</span>
                        <span className="text-sm sm:text-base print:text-xs">{exam.examDate}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 print:hidden" />
                        <span className="font-medium text-sm sm:text-base print:text-xs">Time:</span>
                        <span className="text-sm sm:text-base print:text-xs">{exam.examTime}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 print:hidden" />
                        <span className="font-medium text-sm sm:text-base print:text-xs">Venue:</span>
                        <span className="text-sm sm:text-base print:text-xs">{exam.venue}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0 print:hidden" />
                        <span className="font-medium text-sm sm:text-base print:text-xs">Seat:</span>
                        <span className="text-sm sm:text-base print:text-xs">{exam.seatNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No exams have been assigned to your account yet.</p>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 print:hidden">
            <h4 className="font-semibold text-yellow-800 mb-2">Important Instructions</h4>
            <p className="text-yellow-700">{studentData.instructions}</p>
          </div>

          <div className={`rounded-lg p-3 sm:p-4 mb-6 sm:mb-8 border-2 print:hidden ${studentData.feesBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
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

          <div className="text-center mb-8 print:mb-0 print:mt-4">
            <h4 className="font-semibold text-gray-900 mb-4 print:hidden">Verification QR Code</h4>
            <div className="inline-flex p-3 rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-lg print:p-2 print:shadow-none">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Verification QR code"
                  className="h-32 w-32 print:h-24 print:w-24"
                />
              ) : (
                <span className="text-sm text-slate-500">QR data unavailable</span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 no-print">
            <button
              onClick={onPrint}
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
              onClick={onDownload}
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
                Printing and downloading are disabled until all fees are cleared
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}