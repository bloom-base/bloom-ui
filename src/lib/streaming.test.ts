import { describe, it, expect } from 'vitest'

// Message state management helpers (extracted logic for testing)
interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name?: string
  tool_input?: string
  tool_output?: string
  task_id?: string
}

// Simulates the streaming event handling logic from chat page
function handleStreamEvent(
  messages: Message[],
  event: { type: string; content?: string; tool?: string; input?: Record<string, unknown>; output?: string; event?: string; task?: { id: string } },
  assistantId: string
): Message[] {
  if ((event.type === 'text' || event.type === 'error') && event.content) {
    return messages.map((msg) =>
      msg.id === assistantId ? { ...msg, content: msg.content + event.content } : msg
    )
  }

  if (event.type === 'tool_call' && event.tool) {
    const toolId = `tool-${Date.now()}`
    return [...messages, {
      id: toolId,
      role: 'tool' as const,
      content: '',
      tool_name: event.tool,
      tool_input: event.input ? JSON.stringify(event.input) : undefined,
    }]
  }

  if (event.type === 'tool_result' && event.tool) {
    const lastToolIdx = messages.findLastIndex(
      (m) => m.role === 'tool' && m.tool_name === event.tool && !m.tool_output
    )
    if (lastToolIdx >= 0) {
      return messages.map((msg, idx) =>
        idx === lastToolIdx ? { ...msg, tool_output: event.output } : msg
      )
    }
  }

  if (event.type === 'event' && event.event === 'task_created' && event.task) {
    const lastCreateTaskIdx = messages.findLastIndex(
      (m) => m.role === 'tool' && m.tool_name === 'create_task' && !m.task_id
    )
    if (lastCreateTaskIdx >= 0) {
      return messages.map((msg, idx) =>
        idx === lastCreateTaskIdx ? { ...msg, task_id: event.task!.id } : msg
      )
    }
  }

  return messages
}

describe('Streaming Event Handling', () => {
  const assistantId = 'assistant-1'

  it('appends text to assistant message', () => {
    const messages: Message[] = [
      { id: assistantId, role: 'assistant', content: 'Hello' },
    ]

    const result = handleStreamEvent(
      messages,
      { type: 'text', content: ' world' },
      assistantId
    )

    expect(result[0].content).toBe('Hello world')
  })

  it('adds tool call message for tool_call event', () => {
    const messages: Message[] = [
      { id: assistantId, role: 'assistant', content: 'Let me create a task' },
    ]

    const result = handleStreamEvent(
      messages,
      { type: 'tool_call', tool: 'create_task', input: { title: 'New feature' } },
      assistantId
    )

    expect(result).toHaveLength(2)
    expect(result[1].role).toBe('tool')
    expect(result[1].tool_name).toBe('create_task')
    expect(result[1].tool_input).toBe('{"title":"New feature"}')
    expect(result[1].tool_output).toBeUndefined()
  })

  it('updates tool message with output on tool_result event', () => {
    const messages: Message[] = [
      { id: assistantId, role: 'assistant', content: 'Let me create a task' },
      { id: 'tool-1', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"New feature"}' },
    ]

    const result = handleStreamEvent(
      messages,
      { type: 'tool_result', tool: 'create_task', output: 'Task created: abc123' },
      assistantId
    )

    expect(result[1].tool_output).toBe('Task created: abc123')
  })

  it('updates tool message with task_id on task_created event', () => {
    const messages: Message[] = [
      { id: assistantId, role: 'assistant', content: 'Let me create a task' },
      { id: 'tool-1', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"New feature"}', tool_output: 'Task created' },
    ]

    const result = handleStreamEvent(
      messages,
      { type: 'event', event: 'task_created', task: { id: 'task-123' } },
      assistantId
    )

    expect(result[1].task_id).toBe('task-123')
  })

  it('handles multiple tool calls in sequence', () => {
    let messages: Message[] = [
      { id: assistantId, role: 'assistant', content: '' },
    ]

    // First tool call
    messages = handleStreamEvent(
      messages,
      { type: 'tool_call', tool: 'list_files', input: { path: '/' } },
      assistantId
    )
    expect(messages).toHaveLength(2)

    // First tool result
    messages = handleStreamEvent(
      messages,
      { type: 'tool_result', tool: 'list_files', output: 'src/\npackage.json' },
      assistantId
    )
    expect(messages[1].tool_output).toBe('src/\npackage.json')

    // Second tool call
    messages = handleStreamEvent(
      messages,
      { type: 'tool_call', tool: 'read_file', input: { path: 'package.json' } },
      assistantId
    )
    expect(messages).toHaveLength(3)
    expect(messages[2].tool_name).toBe('read_file')

    // Second tool result
    messages = handleStreamEvent(
      messages,
      { type: 'tool_result', tool: 'read_file', output: '{"name": "test"}' },
      assistantId
    )
    expect(messages[2].tool_output).toBe('{"name": "test"}')
  })

  it('does not modify messages for unknown event types', () => {
    const messages: Message[] = [
      { id: assistantId, role: 'assistant', content: 'Hello' },
    ]

    const result = handleStreamEvent(
      messages,
      { type: 'unknown' },
      assistantId
    )

    expect(result).toEqual(messages)
  })
})
