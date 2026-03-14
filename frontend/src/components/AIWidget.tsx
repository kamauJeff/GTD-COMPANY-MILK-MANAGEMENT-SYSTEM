import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import { AIMessage } from './AIMessage';

const QUICK_PROMPTS = [
  "Who has negative balances this month?",
  "Total litres collected today",
  "Show unpaid farmers end-month",
  "Which routes had zero collections this week?",
];

export function AIWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, loading, sendMessage, clearChat, stopGeneration } = useAIChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  function handleSend() {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .ai-widget-panel { animation: slideUp 0.25s ease; }
        .ai-fab:hover { animation: pulse 0.6s ease; }
      `}</style>

      {/* Floating Button */}
      {!open && (
        <button
          className="ai-fab"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1a4d2e, #2d7a4a)',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(26,77,46,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#f5c842',
          }}
          title="Gutoria AI Assistant"
        >
          ✦
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="ai-widget-panel"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 420, height: 580,
            background: '#f8fdf9', borderRadius: 20,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            border: '1px solid #c8e6d4', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            background: '#1a4d2e', padding: '0.85rem 1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#f5c842',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#1a4d2e',
              }}>G</div>
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Gutoria AI</div>
                <div style={{ color: '#a8d5b5', fontSize: 11 }}>
                  {loading ? '⟳ Thinking...' : '● Online'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={clearChat} title="Clear chat" style={{ background: 'none', border: 'none', color: '#a8d5b5', cursor: 'pointer', fontSize: 16, padding: '4px 6px', borderRadius: 6 }}>↺</button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#a8d5b5', cursor: 'pointer', fontSize: 20, padding: '4px 6px', borderRadius: 6 }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            {messages.map(msg => <AIMessage key={msg.id} message={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts - show only when just welcome message */}
          {messages.length === 1 && (
            <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => { sendMessage(p); }} style={{
                  background: 'white', border: '1px solid #c8e6d4', borderRadius: 16,
                  padding: '4px 10px', fontSize: 11, color: '#1a4d2e', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '0.75rem', borderTop: '1px solid #e0ece4',
            background: 'white', display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about Gutoria data..."
              style={{
                flex: 1, padding: '0.6rem 0.9rem', border: '1.5px solid #ddd',
                borderRadius: 20, fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
            {loading
              ? <button onClick={stopGeneration} style={{ background: '#c0392b', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 14 }}>■</button>
              : <button onClick={handleSend} disabled={!input.trim()} style={{ background: input.trim() ? '#1a4d2e' : '#ccc', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: input.trim() ? 'pointer' : 'default', fontSize: 16 }}>↑</button>
            }
          </div>
        </div>
      )}
    </>
  );
}
