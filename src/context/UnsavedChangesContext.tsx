import { useState, useCallback, useEffect, useRef, type ReactNode, useMemo } from 'react'
import { useBlocker, useLocation } from 'react-router-dom'
import { SaveConfirmationDialog } from '../components/SaveConfirmationDialog'
import { DIALOG_Z } from '../constants/dialogLayers'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { UnsavedChangesContext } from './UnsavedChangesContextInstance'

function UnsavedRouteBlocker({ discardRef }: { discardRef: React.MutableRefObject<(() => void) | null> }) {
  const { hasUnsavedChanges, savePendingChanges } = useUnsavedChanges()
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string; search: string }
      nextLocation: { pathname: string; search: string }
    }) =>
      hasUnsavedChanges &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
    [hasUnsavedChanges],
  )
  const blocker = useBlocker(shouldBlock)

  if (blocker.state !== 'blocked') {
    return null
  }

  return (
    <SaveConfirmationDialog
      isOpen
      onConfirm={async () => {
        const ok = await savePendingChanges()
        if (ok) {
          blocker.proceed()
        } else {
          blocker.reset()
        }
      }}
      onDontSave={() => {
        discardRef.current?.()
        blocker.proceed()
      }}
      onCancel={() => blocker.reset()}
    />
  )
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false)
  const [saveHandler, setSaveHandler] = useState<(() => Promise<boolean>) | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [forceDialog, setForceDialog] = useState(false)
  const discardRef = useRef<(() => void) | null>(null)

  const location = useLocation()
  const previousLocationRef = useRef(location.pathname)

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

  const registerDiscardHandler = useCallback((handler: () => void) => {
    discardRef.current = handler
  }, [])

  const unregisterDiscardHandler = useCallback(() => {
    discardRef.current = null
  }, [])

  const savePendingChanges = useCallback(async () => {
    if (!saveHandler) {
      setHasUnsavedChangesState(false)
      setForceDialog(false)
      return true
    }

    setIsSaving(true)
    try {
      const success = (await saveHandler()) === true
      if (success) {
        setHasUnsavedChangesState(false)
      }
      return success
    } finally {
      setIsSaving(false)
      setForceDialog(false)
    }
  }, [saveHandler])

  const contextValue = useMemo(
    () => ({
      hasUnsavedChanges: hasUnsavedChanges || forceDialog,
      setHasUnsavedChanges,
      savePendingChanges,
      registerSaveHandler,
      unregisterSaveHandler,
      registerDiscardHandler,
      unregisterDiscardHandler,
      forceShowDialog,
    }),
    [
      hasUnsavedChanges,
      forceDialog,
      setHasUnsavedChanges,
      savePendingChanges,
      registerSaveHandler,
      unregisterSaveHandler,
      registerDiscardHandler,
      unregisterDiscardHandler,
      forceShowDialog,
    ],
  )

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}
      <UnsavedRouteBlocker discardRef={discardRef} />
      {isSaving && (
        <div className={`fixed inset-0 ${DIALOG_Z.globalSavingBackdrop} flex items-center justify-center bg-black/50`}>
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span className="text-sm font-medium text-gray-900">Saving changes...</span>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  )
}
