import { useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type MessageRole = 'user' | 'assistant';

export interface ToolCall {
  tool: string;
  input: any;
  result?: any;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  error?: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm **Gutoria AI**, your intelligent dairy management assistant.\n\nI have full access to your data and can help you with:\n- 📊 **Reports** — "Show all farmers paid mid-month in September"\n- 💰 **Payments** — "Who has negative end-month balances on KARIAINI?"\n- 🥛 **Collections** — "Which farmers delivered zero litres this week?"\n- 👥 **Payroll** — "Show me all graders not yet paid this month"\n- ✅ **Actions** — "Approve all end-month payments for KAMAE route"\n\nWhat would you like to know?`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const token = useAuthStore.getState().token;
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    // Build history for API (exclude welcome message)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    history.push({ role: 'user', content: text });

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('AI service unavailable');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);

            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;

              if (event.type === 'text') {
                return { ...m, content: m.content + event.text };
              }
              if (event.type === 'tool_call') {
                return { ...m, toolCalls: [...(m.toolCalls || []), { tool: event.tool, input: event.input }] };
              }
              if (event.type === 'tool_result') {
                const toolCalls = (m.toolCalls || []).map(tc =>
                  tc.tool === event.tool && !tc.result ? { ...tc, result: event.result } : tc
                );
                return { ...m, toolCalls };
              }
              if (event.type === 'done') {
                return { ...m, isStreaming: false };
              }
              if (event.type === 'error') {
                return { ...m, isStreaming: false, error: event.message, content: m.content || 'Sorry, something went wrong.' };
              }
              return m;
            }));
          } catch (_) {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, isStreaming: false, error: 'Connection error', content: 'Sorry, I could not connect to the AI service.' }
          : m
      ));
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m));
      setLoading(false);
    }
  }, [messages, loading, token]);

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `👋 Chat cleared! How can I help you?`,
    }]);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  return { messages, loading, sendMessage, clearChat, stopGeneration };
}
