import { useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { UnsavedChangesContext } from './UnsavedChangesContextInstance'


export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false)
  const [saveHandler, setSaveHandler] = useState<(() => Promise<boolean>) | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [forceDialog, setForceDialog] = useState(false)

  const location = useLocation()
  const previousLocationRef = useRef(location.pathname)

  // Reset unsaved changes when location changes
  useEffect(() => {
    if (previousLocationRef.current !== location.pathname) {
      setHasUnsavedChangesState(false)
      previousLocationRef.current = location.pathname
    }
  }, [location.pathname])

  const setHasUnsavedChanges = useCallback((hasChanges: boolean) => {
    setHasUnsavedChangesState(hasChanges)
  }, [])

  const forceShowDialog = useCallback(() => {
    setForceDialog(true)
  }, [])

  const registerSaveHandler = useCallback((handler: () => Promise<boolean>) => {
    setSaveHandler(() => handler)
  }, [])

  const unregisterSaveHandler = useCallback(() => {
    setSaveHandler(null)
  }, [])

  const savePendingChanges = useCallback(async () => {
    if (!saveHandler) {
      setHasUnsavedChangesState(false)
      return
    }

    setIsSaving(true)
    try {
      const success = await saveHandler()
      if (success) {
        setHasUnsavedChangesState(false)
      }
      return success
    } finally {
      setIsSaving(false)
      setForceDialog(false)
    }
  }, [saveHandler])

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges: hasUnsavedChanges || forceDialog,
        setHasUnsavedChanges,
        savePendingChanges,
        registerSaveHandler,
        unregisterSaveHandler,
        forceShowDialog,
      }}
    >
      {children}
      {isSaving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
              <span className="text-sm font-medium text-gray-900">Saving changes...</span>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  )
}

