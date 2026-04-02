import { X } from 'lucide-react'
import { DIALOG_Z } from '../constants/dialogLayers'

export type ConfirmDialogTone = 'danger' | 'primary' | 'success'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

function toneClasses(tone: ConfirmDialogTone | undefined) {
  if (tone === 'danger') return 'bg-red-500 hover:bg-red-600'
  if (tone === 'success') return 'bg-emerald-600 hover:bg-emerald-700'
  return 'bg-blue-600 hover:bg-blue-700'
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className={`fixed inset-0 ${DIALOG_Z.confirmBackdrop} flex items-center justify-center overflow-y-auto bg-black/40 p-4 py-6`}>
      <div className={`relative ${DIALOG_Z.confirmContent} w-full max-w-md rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            title="Close"
            aria-label="Close dialog"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-gray-600">
          <p>{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void Promise.resolve(onConfirm())}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${toneClasses(tone)}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
