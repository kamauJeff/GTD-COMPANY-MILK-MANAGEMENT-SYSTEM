import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import { AIMessage } from '../components/AIMessage';


const SUGGESTED = [
  { label: "Negative balances", prompt: "Show all farmers with negative end-month balances this month" },
  { label: "Mid-month paid", prompt: "List all farmers paid mid-month this month with their amounts" },
  { label: "Zero litres", prompt: "Which farmers delivered zero litres in the last 7 days?" },
  { label: "Today's collection", prompt: "What is the total litres collected today across all routes?" },
  { label: "Unpaid graders", prompt: "Show all graders not yet paid this month" },
  { label: "Route performance", prompt: "Which route had the highest collection this month?" },
  { label: "KARIAINI farmers", prompt: "List all active farmers on KARIAINI route" },
  { label: "Shop variances", prompt: "Show shops with unreconciled variances" },
];

export default function AIPage() {
  const [input, setInput] = useState('');
  const { messages, loading, sendMessage, clearChat, stopGeneration } = useAIChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function exportChat() {
    const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gutoria-ai-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f0' }}>
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        textarea:focus { outline: none; border-color: #1a4d2e !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: '#1a4d2e', padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: '#f5c842',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#1a4d2e',
          }}>G</div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Gutoria AI</div>
            <div style={{ color: '#a8d5b5', fontSize: 12 }}>
              {loading ? '⟳ Thinking...' : '● Live — connected to your database'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportChat} style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          }}>↓ Export</button>
          <button onClick={clearChat} style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          }}>↺ Clear</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: 220, background: 'white', borderRight: '1px solid #e0ece4',
          padding: '1rem', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Quick Questions</div>
          {SUGGESTED.map((s, i) => (
            <button
              key={i}
              onClick={() => { sendMessage(s.prompt); }}
              disabled={loading}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', marginBottom: 4, borderRadius: 8,
                border: '1px solid #e0ece4', background: 'white',
                fontSize: 12, color: '#1a4d2e', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f8f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              {s.label}
            </button>
          ))}

          <div style={{ marginTop: '1.5rem', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Actions</div>
          {[
            { label: "Approve mid-month payments", prompt: "Approve all pending mid-month payments for this month" },
            { label: "Approve end-month payments", prompt: "Approve all pending end-month payments for this month" },
          ].map((s, i) => (
            <button
              key={i}
              onClick={() => { sendMessage(s.prompt); }}
              disabled={loading}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', marginBottom: 4, borderRadius: 8,
                border: '1px solid #c8e6d4', background: '#f0f8f2',
                fontSize: 12, color: '#1a4d2e', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✅ {s.label}
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {messages.map(msg => <AIMessage key={msg.id} message={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '1rem 1.5rem', borderTop: '1px solid #e0ece4',
            background: 'white', display: 'flex', gap: 10, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything... e.g. 'Show all KAMAE farmers with advances this month'"
              rows={2}
              style={{
                flex: 1, padding: '0.75rem 1rem',
                border: '1.5px solid #ddd', borderRadius: 12,
                fontSize: 14, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            {loading
              ? (
                <button onClick={stopGeneration} style={{
                  background: '#c0392b', border: 'none', borderRadius: 10,
                  width: 44, height: 44, color: 'white', cursor: 'pointer', fontSize: 16, flexShrink: 0,
                }}>■</button>
              ) : (
                <button onClick={handleSend} disabled={!input.trim()} style={{
                  background: input.trim() ? '#1a4d2e' : '#ddd',
                  border: 'none', borderRadius: 10, width: 44, height: 44,
                  color: 'white', cursor: input.trim() ? 'pointer' : 'default',
                  fontSize: 18, flexShrink: 0,
                }}>↑</button>
              )
            }
          </div>
          <div style={{ background: 'white', paddingBottom: '0.5rem', textAlign: 'center', fontSize: 11, color: '#aaa' }}>
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
