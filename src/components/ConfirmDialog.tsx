'use client'

import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
      confirmRef.current?.focus()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full backdrop:bg-black/40"
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel()
      }}
    >
      <div className="flex items-center justify-center min-h-full p-4">
        <div className="bg-surface rounded-xl shadow-lg border border-line p-6 w-full max-w-sm">
          <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
          <p className="text-sm text-ink-secondary mb-6">{description}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-line text-ink-secondary hover:bg-canvas-subtle transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                destructive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-ink text-canvas hover:bg-ink/90'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
