import React from 'react';
import type { ChatMessage } from '../hooks/useAIChat';

const TOOL_LABELS: Record<string, string> = {
  query_farmers: '🌾 Querying farmers...',
  query_farmer_payments: '💰 Fetching payment records...',
  query_collections: '🥛 Fetching collection data...',
  query_payroll: '👥 Fetching payroll...',
  query_advances: '📋 Fetching advances...',
  query_factory: '🏭 Fetching factory data...',
  query_shops: '🏪 Fetching shop data...',
  get_summary_stats: '📊 Getting summary stats...',
  approve_farmer_payments: '✅ Approving payments...',
  record_advance: '📝 Recording advance...',
};

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.includes('---')) {
      const headers = line.split('|').map(h => h.trim()).filter(Boolean);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
        i++;
      }
      elements.push(
        <div key={i} style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1a4d2e', color: 'white' }}>
                {headers.map((h, j) => (
                  <th key={j} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} style={{ background: j % 2 === 0 ? '#f8fdf9' : 'white', borderBottom: '1px solid #e0ece4' }}>
                  {row.map((cell, k) => (
                    <td key={k} style={{ padding: '7px 12px', fontSize: 13 }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 600, color: '#1a4d2e', margin: '1rem 0 0.4rem' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 600, color: '#1a4d2e', margin: '1rem 0 0.5rem' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 19, fontWeight: 700, color: '#1a4d2e', margin: '1rem 0 0.5rem' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={i} style={{ marginLeft: '1.2rem', marginBottom: '0.2rem', fontSize: 14 }}>{inlineFormat(line.slice(2))}</li>);
    } else if (line === '') {
      elements.push(<div key={i} style={{ height: '0.5rem' }} />);
    } else {
      elements.push(<p key={i} style={{ margin: '0 0 0.3rem', fontSize: 14, lineHeight: 1.6 }}>{inlineFormat(line)}</p>);
    }
    i++;
  }
  return elements;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#f0f4f0', padding: '1px 5px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

interface Props {
  message: ChatMessage;
}

export function AIMessage({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div style={{
          background: '#1a4d2e', color: 'white', borderRadius: '18px 18px 4px 18px',
          padding: '0.75rem 1.1rem', maxWidth: '80%', fontSize: 14, lineHeight: 1.5,
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#f5c842',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#1a4d2e', flexShrink: 0, marginTop: 4,
      }}>G</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tool calls indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            {message.toolCalls.map((tc, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: tc.result ? '#f0f8f2' : '#fff8e6',
                border: `1px solid ${tc.result ? '#c8e6d4' : '#f5c842'}`,
                borderRadius: 20, padding: '3px 12px', fontSize: 12,
                color: tc.result ? '#1a4d2e' : '#856900', marginRight: 6, marginBottom: 4,
              }}>
                {tc.result ? '✓' : '⟳'} {TOOL_LABELS[tc.tool] || tc.tool}
                {tc.result?.count !== undefined && (
                  <span style={{ fontWeight: 600 }}>{tc.result.count} records</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        <div style={{
          background: 'white', borderRadius: '4px 18px 18px 18px',
          padding: '0.85rem 1.1rem', border: '1px solid #e8f0ea',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          {message.content ? renderMarkdown(message.content) : null}
          {message.isStreaming && (
            <span style={{ display: 'inline-block', width: 8, height: 14, background: '#1a4d2e', borderRadius: 2, animation: 'blink 1s infinite', verticalAlign: 'middle' }} />
          )}
          {message.error && (
            <div style={{ color: '#c0392b', fontSize: 13, marginTop: '0.5rem' }}>⚠ {message.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
