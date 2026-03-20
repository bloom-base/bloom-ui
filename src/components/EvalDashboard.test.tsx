import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import EvalDashboard from './EvalDashboard'
import * as api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  getProjectEvals: vi.fn(),
}))

const mockGetProjectEvals = vi.mocked(api.getProjectEvals)

describe('EvalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    mockGetProjectEvals.mockReturnValue(new Promise(() => {})) // Never resolves
    render(<EvalDashboard projectId="test-project" />)
    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows empty state when no evals', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 0,
      avg_quality_score: null,
      avg_completion: null,
      avg_efficiency: null,
      avg_cost: null,
      avg_reliability: null,
      trend: null,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('No evaluations yet. Scores appear when tasks complete.')).toBeTruthy()
    })
  })

  it('displays quality score badge', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 5,
      avg_quality_score: 85,
      avg_completion: 0.95,
      avg_efficiency: 0.8,
      avg_cost: 0.75,
      avg_reliability: 0.9,
      trend: 3.5,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('85')).toBeTruthy()
    })
  })

  it('displays dimension score bars', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 5,
      avg_quality_score: 80,
      avg_completion: 0.9,
      avg_efficiency: 0.7,
      avg_cost: 0.6,
      avg_reliability: 0.85,
      trend: null,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('Completion')).toBeTruthy()
      expect(screen.getByText('Efficiency')).toBeTruthy()
      expect(screen.getByText('Cost')).toBeTruthy()
      expect(screen.getByText('Reliability')).toBeTruthy()
    })
  })

  it('displays trend indicator', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 10,
      avg_quality_score: 82,
      avg_completion: 0.9,
      avg_efficiency: 0.8,
      avg_cost: 0.7,
      avg_reliability: 0.85,
      trend: 5.2,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('+5.2')).toBeTruthy()
    })
  })

  it('displays negative trend', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 10,
      avg_quality_score: 70,
      avg_completion: 0.8,
      avg_efficiency: 0.6,
      avg_cost: 0.5,
      avg_reliability: 0.7,
      trend: -3.0,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('-3')).toBeTruthy()
    })
  })

  it('displays recent evals list', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 3,
      avg_quality_score: 78,
      avg_completion: 0.85,
      avg_efficiency: 0.7,
      avg_cost: 0.65,
      avg_reliability: 0.8,
      trend: null,
      recent_evals: [
        {
          task_id: 'task-1',
          quality_score: 90,
          completion_score: 1.0,
          efficiency_score: 0.9,
          cost_score: 0.8,
          reliability_score: 0.95,
          total_cost_usd: 0.35,
          total_turns: 15,
          model_used: 'claude-sonnet-4-5-20250929',
          computed_at: '2026-02-27T12:00:00',
        },
      ],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('Recent')).toBeTruthy()
      expect(screen.getByText('claude-sonnet-4-5-20250929')).toBeTruthy()
      expect(screen.getByText('$0.35')).toBeTruthy()
      expect(screen.getByText('15t')).toBeTruthy()
      expect(screen.getByText('90')).toBeTruthy()
    })
  })

  it('shows task count', async () => {
    mockGetProjectEvals.mockResolvedValue({
      task_count: 42,
      avg_quality_score: 75,
      avg_completion: 0.8,
      avg_efficiency: 0.7,
      avg_cost: 0.6,
      avg_reliability: 0.75,
      trend: null,
      recent_evals: [],
    })

    render(<EvalDashboard projectId="test-project" />)
    await waitFor(() => {
      expect(screen.getByText('42 tasks evaluated')).toBeTruthy()
    })
  })
})
