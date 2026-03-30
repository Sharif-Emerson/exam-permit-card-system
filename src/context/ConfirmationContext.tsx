import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import ConfirmDialog, { type ConfirmDialogTone } from '../components/ConfirmDialog'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
}

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void }

const ConfirmationContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const finish = useCallback((result: boolean) => {
    setState((current) => {
      if (current) {
        current.resolve(result)
      }
      return null
    })
  }, [])

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state !== null}
        title={state?.title ?? ''}
        message={state?.message ?? ''}
        confirmLabel={state?.confirmLabel ?? 'OK'}
        cancelLabel={state?.cancelLabel ?? 'Cancel'}
        tone={state?.tone ?? 'primary'}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmationContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmationContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmationProvider')
  }
  return ctx
}
