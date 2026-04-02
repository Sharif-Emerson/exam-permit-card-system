import { LogOut, X } from 'lucide-react'
import { DIALOG_Z } from '../constants/dialogLayers'

type SignOutDialogProps = {
  onConfirm: () => void
  onCancel: () => void
  signingOut: boolean
}

export default function SignOutDialog({ onConfirm, onCancel, signingOut }: SignOutDialogProps) {
  return (
    <div
      className={`kiu-fade-in-fast fixed inset-0 ${DIALOG_Z.confirmBackdrop} flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
    >
      <div
        className={`kiu-dialog-up relative ${DIALOG_Z.confirmContent} w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900`}
      >
        {/* Green header */}
        <div className="relative bg-gradient-to-br from-emerald-600 to-green-500 px-6 py-6 text-center text-white">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel sign out"
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 shadow-inner">
            <LogOut className="h-7 w-7" />
          </div>
          <h2 id="signout-title" className="text-xl font-bold">Sign Out?</h2>
          <p className="mt-1 text-sm text-emerald-100">You are about to leave your session</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to sign out? You will need your credentials to sign back in.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              id="signout-cancel-btn"
              type="button"
              onClick={onCancel}
              disabled={signingOut}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Stay
            </button>
            <button
              id="signout-confirm-btn"
              type="button"
              onClick={onConfirm}
              disabled={signingOut}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Yes, Sign Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
