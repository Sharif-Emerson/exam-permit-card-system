import { createContext } from 'react'

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (hasChanges: boolean) => void
  savePendingChanges: () => Promise<boolean | undefined>
  registerSaveHandler: (handler: () => Promise<boolean>) => void
  unregisterSaveHandler: () => void
  forceShowDialog: () => void
}

export const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined)
