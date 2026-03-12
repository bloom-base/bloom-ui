import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentMarkdown } from './Markdown'

describe('AgentMarkdown', () => {
  it('renders plain text', () => {
    render(<AgentMarkdown content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    render(<AgentMarkdown content="This is **bold** text" />)
    expect(screen.getByText('bold')).toBeInTheDocument()
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('renders italic text', () => {
    render(<AgentMarkdown content="This is *italic* text" />)
    expect(screen.getByText('italic')).toBeInTheDocument()
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('renders unordered lists', () => {
    render(<AgentMarkdown content={"- item one\n- item two"} />)
    expect(screen.getByText('item one')).toBeInTheDocument()
    expect(screen.getByText('item two')).toBeInTheDocument()
  })

  it('renders ordered lists', () => {
    render(<AgentMarkdown content={"1. first\n2. second"} />)
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('renders inline code', () => {
    render(<AgentMarkdown content="Use `npm install` to install" />)
    const code = screen.getByText('npm install')
    expect(code.tagName).toBe('CODE')
  })

  it('renders links with target blank', () => {
    render(<AgentMarkdown content="Visit [example](https://example.com)" />)
    const link = screen.getByText('example')
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('uses dark theme classes when dark prop is true', () => {
    const { container } = render(
      <AgentMarkdown content="Hello **world**" dark />
    )
    const paragraph = container.querySelector('p')
    expect(paragraph?.className).toContain('text-zinc-100')
  })

  it('uses light theme classes by default', () => {
    const { container } = render(
      <AgentMarkdown content="Hello **world**" />
    )
    const paragraph = container.querySelector('p')
    expect(paragraph?.className).toContain('text-gray-900')
  })

  it('renders headings', () => {
    render(<AgentMarkdown content="## Section Title" />)
    expect(screen.getByText('Section Title')).toBeInTheDocument()
    expect(screen.getByText('Section Title').tagName).toBe('H2')
  })
})
