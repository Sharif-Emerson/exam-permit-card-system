import React from 'react'
import { DIALOG_Z } from '../constants/dialogLayers'

export type NotificationType = 'success' | 'error'

export interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

const bgColors = {
  success: 'bg-emerald-100 border-emerald-400 text-emerald-800',
  error: 'bg-red-100 border-red-400 text-red-800',
};

export default function Notification({ message, type, onClose }: NotificationProps) {
  if (!message) return null;
  return (
    <div className={`fixed top-6 right-6 ${DIALOG_Z.toast} rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ${bgColors[type]}`}
         role="alert">
      <div className="flex items-center justify-between gap-4">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-lg font-bold leading-none focus:outline-none">&times;</button>
      </div>
    </div>
  );
}
