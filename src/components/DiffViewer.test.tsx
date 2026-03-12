import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import DiffViewer from './DiffViewer'
import type { PRFileChange } from '@/lib/api'

const sampleFiles: PRFileChange[] = [
  {
    filename: 'src/main.py',
    status: 'modified',
    additions: 10,
    deletions: 3,
    patch: '@@ -1,5 +1,12 @@\n+import os\n def main():\n-    pass\n+    print("hello")',
  },
  {
    filename: 'tests/test_main.py',
    status: 'added',
    additions: 25,
    deletions: 0,
    patch: '@@ -0,0 +1,25 @@\n+def test_main():\n+    assert True',
  },
]

describe('DiffViewer', () => {
  it('renders loading state with spinner', () => {
    render(<DiffViewer files={[]} loading={true} onClose={vi.fn()} />)
    expect(screen.getByText('Loading diff...')).toBeTruthy()
    // Spinner SVG should be present (animate-spin class)
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('does not show file count or totals while loading', () => {
    render(<DiffViewer files={[]} loading={true} onClose={vi.fn()} />)
    expect(screen.queryByText(/files/)).toBeNull()
  })

  it('renders empty state when no files and not loading', () => {
    render(<DiffViewer files={[]} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('No file changes')).toBeTruthy()
  })

  it('renders file changes with filenames', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('src/main.py')).toBeTruthy()
    expect(screen.getByText('tests/test_main.py')).toBeTruthy()
  })

  it('renders file count in header', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('2 files')).toBeTruthy()
  })

  it('renders total additions and deletions in header', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    // Total additions: 10 + 25 = 35 (unique to header, not duplicated in per-file)
    expect(screen.getByText('+35')).toBeTruthy()
    // Total deletions: 3 + 0 = 3. This also matches the first file's per-file deletions,
    // so use getAllByText to verify at least the header has it.
    const delElements = screen.getAllByText('-3')
    expect(delElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders per-file additions and deletions', () => {
    const singleFile: PRFileChange[] = [
      {
        filename: 'only.py',
        status: 'modified',
        additions: 7,
        deletions: 2,
        patch: '@@ -1,3 +1,8 @@\n+new line',
      },
    ]
    render(<DiffViewer files={singleFile} loading={false} onClose={vi.fn()} />)
    // With a single file, header totals and per-file counts are duplicated.
    // Use getAllByText to verify they appear (header + file row = 2 each).
    const addElements = screen.getAllByText('+7')
    expect(addElements.length).toBe(2)
    const delElements = screen.getAllByText('-2')
    expect(delElements.length).toBe(2)
  })

  it('renders file status badges', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('modified')).toBeTruthy()
    expect(screen.getByText('added')).toBeTruthy()
  })

  it('renders patch lines with correct content', () => {
    const singleFile: PRFileChange[] = [
      {
        filename: 'app.py',
        status: 'modified',
        additions: 1,
        deletions: 1,
        patch: '@@ -1,3 +1,3 @@\ncontext_line\n-old line\n+new line',
      },
    ]
    render(<DiffViewer files={singleFile} loading={false} onClose={vi.fn()} />)
    // Hunk header
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toBeTruthy()
    // Context line (no leading space to avoid whitespace normalization issues)
    expect(screen.getByText('context_line')).toBeTruthy()
    // Deleted line
    expect(screen.getByText('-old line')).toBeTruthy()
    // Added line
    expect(screen.getByText('+new line')).toBeTruthy()
  })

  it('applies correct CSS classes to diff lines', () => {
    const singleFile: PRFileChange[] = [
      {
        filename: 'styled.py',
        status: 'modified',
        additions: 1,
        deletions: 1,
        patch: '@@ -1,2 +1,2 @@\n-removed_line\n+added_line',
      },
    ]
    render(<DiffViewer files={singleFile} loading={false} onClose={vi.fn()} />)

    const addedLine = screen.getByText('+added_line')
    expect(addedLine.className).toContain('bg-green-50')

    const removedLine = screen.getByText('-removed_line')
    expect(removedLine.className).toContain('bg-red-50')

    const hunkLine = screen.getByText('@@ -1,2 +1,2 @@')
    expect(hunkLine.className).toContain('bg-blue-50')
  })

  it('shows binary file message when patch is empty', () => {
    const binaryFile: PRFileChange[] = [
      {
        filename: 'image.png',
        status: 'modified',
        additions: 0,
        deletions: 0,
        patch: '',
      },
    ]
    render(<DiffViewer files={binaryFile} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('Binary file or no diff available')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<DiffViewer files={sampleFiles} loading={false} onClose={onClose} />)

    const closeButton = screen.getByLabelText('Close diff viewer')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders Changes header text', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('Changes')).toBeTruthy()
  })

  it('close button shows Close text', () => {
    render(<DiffViewer files={sampleFiles} loading={false} onClose={vi.fn()} />)
    expect(screen.getByText('Close')).toBeTruthy()
  })

  it('renders file collapse/expand toggle', () => {
    const singleFile: PRFileChange[] = [
      {
        filename: 'toggle.py',
        status: 'modified',
        additions: 1,
        deletions: 0,
        patch: '+line',
      },
    ]
    render(<DiffViewer files={singleFile} loading={false} onClose={vi.fn()} />)
    // The file header is a button that can toggle collapse
    const fileButton = screen.getByText('toggle.py').closest('button')
    expect(fileButton).toBeTruthy()
  })

  it('collapses file diff when file header is clicked', () => {
    const singleFile: PRFileChange[] = [
      {
        filename: 'collapsible.py',
        status: 'modified',
        additions: 1,
        deletions: 0,
        patch: '+added line',
      },
    ]
    render(<DiffViewer files={singleFile} loading={false} onClose={vi.fn()} />)

    // Patch content is visible initially
    expect(screen.getByText('+added line')).toBeTruthy()

    // Click file header to collapse
    const fileButton = screen.getByText('collapsible.py').closest('button')!
    fireEvent.click(fileButton)

    // Patch content should be hidden
    expect(screen.queryByText('+added line')).toBeNull()
  })
})
