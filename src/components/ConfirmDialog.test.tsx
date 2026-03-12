import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ConfirmDialog } from './ConfirmDialog'

// Mock HTMLDialogElement methods not available in jsdom
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

describe('ConfirmDialog', () => {
  const baseProps = {
    open: true,
    title: 'Delete item?',
    description: 'This action cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders title and description when open', () => {
    render(<ConfirmDialog {...baseProps} />)

    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />)

    expect(container.querySelector('dialog')).toBeNull()
  })

  it('shows default button labels', () => {
    render(<ConfirmDialog {...baseProps} />)

    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows custom button labels', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Yes, delete" cancelLabel="No, keep" />)

    expect(screen.getByText('Yes, delete')).toBeInTheDocument()
    expect(screen.getByText('No, keep')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByText('Confirm'))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('applies destructive styling when destructive is true', () => {
    render(<ConfirmDialog {...baseProps} destructive={true} />)

    const confirmBtn = screen.getByText('Confirm')
    expect(confirmBtn.className).toContain('bg-red-600')
  })

  it('applies default styling when destructive is false', () => {
    render(<ConfirmDialog {...baseProps} destructive={false} />)

    const confirmBtn = screen.getByText('Confirm')
    expect(confirmBtn.className).toContain('bg-gray-900')
  })
})
