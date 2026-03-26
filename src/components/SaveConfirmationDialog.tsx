import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUnsavedChanges } from '../context/UnsavedChangesContext'

interface SaveConfirmationDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  onDontSave: () => void
}

export function SaveConfirmationDialog({ isOpen, onConfirm, onCancel, onDontSave }: SaveConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Unsaved Changes</h3>
          <p className="mt-2 text-sm text-gray-500">
            You have unsaved changes. Would you like to save them before leaving?
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            💾 Save Changes
          </button>
          <button
            onClick={onDontSave}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Don't Save
          </button>
          <button
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

// Hook to handle navigation with unsaved changes
export function useNavigationWithConfirmation() {
  const navigate = useNavigate()
  const { hasUnsavedChanges, savePendingChanges, setHasUnsavedChanges } = useUnsavedChanges()
  const [showDialog, setShowDialog] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  const handleConfirmSave = useCallback(async () => {
    setShowDialog(false)
    setIsBlocked(false)
    const saved = await savePendingChanges()
    setHasUnsavedChanges(false)
    // After saving, navigate to login
    navigate('/login', { replace: true })
  }, [savePendingChanges, navigate, setHasUnsavedChanges])

  const handleDontSave = useCallback(() => {
    setShowDialog(false)
    setIsBlocked(false)
    setHasUnsavedChanges(false)
    // Navigate to login without saving
    navigate('/login', { replace: true })
  }, [navigate, setHasUnsavedChanges])

  const handleCancel = useCallback(() => {
    setShowDialog(false)
    // Push state back to prevent back navigation
    window.history.pushState({ page: window.location.pathname }, '', window.location.pathname)
  }, [])

  // Intercept back button when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return

    // Push a state to intercept back button
    window.history.pushState({ page: window.location.pathname, protected: true }, '')
    setIsBlocked(true)

    const handlePopState = (event: PopStateEvent) => {
      // Only show dialog if we're still on a protected page
      if (hasUnsavedChanges && isBlocked) {
        event.preventDefault()
        event.stopPropagation()
        setShowDialog(true)
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    return () => {
      window.removeEventListener('popstate', handlePopState)
      setIsBlocked(false)
    }
  }, [hasUnsavedChanges, isBlocked])

  return {
    showDialog,
    handleConfirmSave,
    handleDontSave,
    handleCancel,
  }
}
