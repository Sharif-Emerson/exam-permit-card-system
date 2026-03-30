/**
 * Tailwind z-index classes for overlays. Higher = in front.
 * App chrome (mobile sidebar scrims, sidebars): ~z-20–z-40.
 * Full-screen modal forms: 90–91 (below confirmations).
 * Confirmations, sign-out, destructive prompts: 100–101.
 * Toasts: 110 (above modals).
 * Global busy / leave-page prompts: 9999+ (see below).
 */
export const DIALOG_Z = {
  modalBackdrop: 'z-[90]',
  modalContent: 'z-[91]',
  confirmBackdrop: 'z-[100]',
  confirmContent: 'z-[101]',
  toast: 'z-[110]',
  globalSavingBackdrop: 'z-[9999]',
  leaveSaveBackdrop: 'z-[10000]',
  leaveSaveContent: 'z-[10001]',
} as const
