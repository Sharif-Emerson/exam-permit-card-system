import { DIALOG_Z } from '../constants/dialogLayers'

interface SaveConfirmationDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  onDontSave: () => void
}

export function SaveConfirmationDialog({ isOpen, onConfirm, onCancel, onDontSave }: SaveConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 ${DIALOG_Z.leaveSaveBackdrop} flex items-center justify-center bg-black/50`}>
      <div className={`relative ${DIALOG_Z.leaveSaveContent} w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl`}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Save changes?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Do you want to save your changes before leaving? Unsaved work will be lost if you choose not to save.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void Promise.resolve(onConfirm())}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Save now
          </button>
          <button
            type="button"
            onClick={onDontSave}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Don&apos;t save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

