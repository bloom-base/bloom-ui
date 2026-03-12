import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock the API module
vi.mock('@/lib/api', () => ({
  searchProject: vi.fn(),
}))

import SearchPanel from './SearchPanel'
import { searchProject } from '@/lib/api'

const mockSearchProject = searchProject as ReturnType<typeof vi.fn>

function makeCodeResult(overrides: Record<string, unknown> = {}) {
  return {
    result_type: 'code',
    content: 'def authenticate(user):',
    score: 0.85,
    provenance: { source: 'embedding', commit_sha: 'abc1234', task_id: null, task_title: null, pr_number: null, pr_url: null, conversation_id: null },
    file_path: 'src/auth.py',
    start_line: 10,
    end_line: 25,
    language: 'python',
    ...overrides,
  }
}

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and filter tabs', () => {
    render(<SearchPanel projectId="test-project-id" />)
    expect(screen.getByPlaceholderText('Search code, knowledge, conversations...')).toBeDefined()
    expect(screen.getByText('All')).toBeDefined()
    expect(screen.getByText('Code')).toBeDefined()
    expect(screen.getByText('Knowledge')).toBeDefined()
    expect(screen.getByText('Docs')).toBeDefined()
    expect(screen.getByText('Messages')).toBeDefined()
  })

  it('shows placeholder text before searching', () => {
    render(<SearchPanel projectId="test-project-id" />)
    expect(screen.getByText(/Search across this project/)).toBeDefined()
  })

  it('calls searchProject on Enter key', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'auth',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'auth' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'auth',
        expect.objectContaining({ limit: 20 })
      )
    })
  })

  it('displays code results with file path', async () => {
    mockSearchProject.mockResolvedValue({
      results: [makeCodeResult()],
      total: 1,
      query: 'auth',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'auth' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('src/auth.py:10-25')).toBeDefined()
      expect(screen.getByText('85%')).toBeDefined()
      expect(screen.getByText('python')).toBeDefined()
    })
  })

  it('displays knowledge results with category badge', async () => {
    mockSearchProject.mockResolvedValue({
      results: [
        {
          result_type: 'knowledge',
          content: '[decision] Use JWT for authentication\nWe chose JWT over session cookies...',
          score: 0.7,
          provenance: { source: 'knowledge', commit_sha: null, task_id: null, task_title: null, pr_number: null, pr_url: null, conversation_id: null },
          title: 'Auth approach',
          category: 'decision',
          tags: ['auth', 'security'],
        },
      ],
      total: 1,
      query: 'auth',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'auth' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Auth approach')).toBeDefined()
      expect(screen.getByText('decision')).toBeDefined()
      expect(screen.getByText('auth')).toBeDefined()
      expect(screen.getByText('security')).toBeDefined()
    })
  })

  it('displays provenance with PR link', async () => {
    mockSearchProject.mockResolvedValue({
      results: [
        {
          result_type: 'code',
          content: 'function login()',
          score: 0.9,
          provenance: {
            source: 'embedding',
            commit_sha: null,
            task_id: 'task-1',
            task_title: 'Add login flow',
            pr_number: 42,
            pr_url: 'https://github.com/o/r/pull/42',
            conversation_id: null,
          },
          file_path: 'src/login.ts',
          start_line: 1,
          end_line: 30,
        },
      ],
      total: 1,
      query: 'login',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'login' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      const link = screen.getByText('Add login flow · PR #42')
      expect(link).toBeDefined()
      expect(link.getAttribute('href')).toBe('https://github.com/o/r/pull/42')
    })
  })

  it('shows no results message when empty', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'nonexistent',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'nonexistent' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/No results found/)).toBeDefined()
    })
  })

  it('shows result count footer', async () => {
    mockSearchProject.mockResolvedValue({
      results: [makeCodeResult({ file_path: 'test.py', start_line: 1, end_line: 5, score: 0.5 })],
      total: 1,
      query: 'test',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/1 result/)).toBeDefined()
      expect(screen.getByText(/hybrid lexical/)).toBeDefined()
    })
  })

  // ====================================================
  // Filter tab clicks changing active filter
  // ====================================================

  it('clicking Code filter tab triggers search with code type', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'auth',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    // Type a query first and trigger search via Enter
    fireEvent.change(input, { target: { value: 'auth' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'auth',
        expect.objectContaining({ types: undefined, limit: 20 })
      )
    })

    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'auth' })

    // Click the Code filter tab
    fireEvent.click(screen.getByText('Code'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'auth',
        expect.objectContaining({ types: ['code'], limit: 20 })
      )
    })
  })

  it('clicking Knowledge filter tab triggers search with knowledge type', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'test',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalled()
    })

    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'test' })

    fireEvent.click(screen.getByText('Knowledge'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'test',
        expect.objectContaining({ types: ['knowledge'] })
      )
    })
  })

  it('clicking Docs filter tab triggers search with document type', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'readme',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    fireEvent.change(input, { target: { value: 'readme' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalled()
    })

    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'readme' })

    fireEvent.click(screen.getByText('Docs'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'readme',
        expect.objectContaining({ types: ['document'] })
      )
    })
  })

  it('clicking Messages filter tab triggers search with message type', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'hello',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalled()
    })

    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'hello' })

    fireEvent.click(screen.getByText('Messages'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'hello',
        expect.objectContaining({ types: ['message'] })
      )
    })
  })

  it('clicking Conversations filter tab triggers search with conversation type', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'bug',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    fireEvent.change(input, { target: { value: 'bug' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalled()
    })

    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'bug' })

    fireEvent.click(screen.getByText('Conversations'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'bug',
        expect.objectContaining({ types: ['conversation'] })
      )
    })
  })

  it('clicking All filter tab switches back to unfiltered search', async () => {
    mockSearchProject.mockResolvedValue({
      results: [],
      total: 0,
      query: 'auth',
    })

    render(<SearchPanel projectId="test-project-id" />)
    const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

    fireEvent.change(input, { target: { value: 'auth' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalled()
    })

    // Switch to Code filter
    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'auth' })
    fireEvent.click(screen.getByText('Code'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'auth',
        expect.objectContaining({ types: ['code'] })
      )
    })

    // Switch back to All
    mockSearchProject.mockClear()
    mockSearchProject.mockResolvedValue({ results: [], total: 0, query: 'auth' })
    fireEvent.click(screen.getByText('All'))

    await waitFor(() => {
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'auth',
        expect.objectContaining({ types: undefined })
      )
    })
  })

  it('filter tabs do not trigger search when query is empty', () => {
    render(<SearchPanel projectId="test-project-id" />)

    // Click Code tab without typing anything
    fireEvent.click(screen.getByText('Code'))

    // Should not have called searchProject since query is empty
    expect(mockSearchProject).not.toHaveBeenCalled()
  })

  it('active filter tab has distinct styling (bg-gray-900)', () => {
    render(<SearchPanel projectId="test-project-id" />)

    // "All" is active by default
    const allButton = screen.getByText('All')
    expect(allButton.className).toContain('bg-gray-900')

    // "Code" is not active
    const codeButton = screen.getByText('Code')
    expect(codeButton.className).not.toContain('bg-gray-900')

    // Click Code to make it active
    fireEvent.click(codeButton)

    // Now Code should be active
    expect(screen.getByText('Code').className).toContain('bg-gray-900')
    // All should no longer be active
    expect(screen.getByText('All').className).not.toContain('bg-gray-900')
  })

  // ====================================================
  // Debounced search behavior (uses fake timers)
  // ====================================================

  describe('debounce behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not fire search immediately on input change', async () => {
      mockSearchProject.mockResolvedValue({
        results: [],
        total: 0,
        query: 'test',
      })

      render(<SearchPanel projectId="test-project-id" />)
      const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

      // Type without pressing Enter
      fireEvent.change(input, { target: { value: 'test' } })

      // searchProject should NOT have been called immediately
      expect(mockSearchProject).not.toHaveBeenCalled()

      // Advance timer by 300ms (the debounce delay)
      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Now it should have been called
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'test',
        expect.objectContaining({ limit: 20 })
      )
    })

    it('resets on each keystroke — only last value fires', async () => {
      mockSearchProject.mockResolvedValue({
        results: [],
        total: 0,
        query: 'final',
      })

      render(<SearchPanel projectId="test-project-id" />)
      const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

      // Type quickly — each keystroke should reset debounce
      fireEvent.change(input, { target: { value: 'f' } })
      await act(async () => { vi.advanceTimersByTime(100) })

      fireEvent.change(input, { target: { value: 'fi' } })
      await act(async () => { vi.advanceTimersByTime(100) })

      fireEvent.change(input, { target: { value: 'fin' } })
      await act(async () => { vi.advanceTimersByTime(100) })

      fireEvent.change(input, { target: { value: 'final' } })

      // Still not called because debounce resets each time
      expect(mockSearchProject).not.toHaveBeenCalled()

      // Advance past the debounce delay
      await act(async () => { vi.advanceTimersByTime(300) })

      // Should only have been called once, with the final value
      expect(mockSearchProject).toHaveBeenCalledTimes(1)
      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'final',
        expect.objectContaining({ limit: 20 })
      )
    })

    it('Enter key bypasses debounce and fires search immediately', async () => {
      mockSearchProject.mockResolvedValue({
        results: [],
        total: 0,
        query: 'instant',
      })

      render(<SearchPanel projectId="test-project-id" />)
      const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

      fireEvent.change(input, { target: { value: 'instant' } })

      // Not called yet (still within debounce window)
      expect(mockSearchProject).not.toHaveBeenCalled()

      // Press Enter immediately — this calls runSearch synchronously
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' })
      })

      expect(mockSearchProject).toHaveBeenCalledWith(
        'test-project-id',
        'instant',
        expect.objectContaining({ limit: 20 })
      )
    })

    it('clearing input after search resets results', async () => {
      mockSearchProject.mockResolvedValue({
        results: [makeCodeResult()],
        total: 1,
        query: 'auth',
      })

      render(<SearchPanel projectId="test-project-id" />)
      const input = screen.getByPlaceholderText('Search code, knowledge, conversations...')

      // Search first via Enter
      await act(async () => {
        fireEvent.change(input, { target: { value: 'auth' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      })

      expect(screen.getByText('src/auth.py:10-25')).toBeDefined()

      // Clear the input — triggers debounced runSearch with empty string
      fireEvent.change(input, { target: { value: '' } })

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      // Should be back to placeholder state
      expect(screen.getByText(/Search across this project/)).toBeDefined()
    })
  })
})
