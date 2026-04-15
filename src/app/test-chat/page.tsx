'use client';

import { useState, useRef, useEffect } from 'react';

const BUSINESS_ID = '06203464-2b76-4468-8d2e-6630ab0ed71a';
const TEST_PHONE = 'test-chat-lead';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolsCalled?: string[];
  stepsUsed?: number;
}

export default function TestChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, phone: TEST_PHONE, businessId: BUSINESS_ID }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `[Error: ${data.error}]`,
          timestamp: new Date(),
        }]);
        setLoading(false);
        return;
      }

      const taskId = data.taskId;

      // Poll until agent is done
      let finalData;
      while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const pRes = await fetch(`/api/test-chat?taskId=${taskId}`);
        const pData = await pRes.json();
        
        if (pData.status === 'completed' || pData.status === 'failed') {
          finalData = pData;
          break;
        }
      }

      // Show each bubble the agent would have sent via WhatsApp
      const bubbles: string[] = finalData.bubbles || [];
      for (let i = 0; i < bubbles.length; i++) {
        const aiMsg: Message = {
          id: `${Date.now()}-${i}`,
          role: 'assistant',
          content: bubbles[i],
          timestamp: new Date(),
          toolsCalled: i === 0 ? finalData.toolsCalled : undefined,
          stepsUsed: i === 0 ? finalData.stepsUsed : undefined,
        };
        setMessages(prev => [...prev, aiMsg]);
      }
      // Show agent metadata as a system note
      if (finalData.stepsUsed || finalData.status) {
        setMessages(prev => [...prev, {
          id: `${Date.now()}-meta`,
          role: 'system',
          content: `Agent: ${finalData.status} in ${finalData.stepsUsed} steps | Tools: ${(finalData.toolsCalled || []).join(', ') || 'none'}`,
          timestamp: new Date(),
        }]);
      }

      // Re-fetch chat history after setting UI local state (optional, we simulated it here)
      // Actually we need to make sure the agent saved its response to chat_history,
      // but since it uses send_whatsapp, the history is updated automatically by the executeSendWhatsApp mock.
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '[Network error]',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function clearChat() {
    await fetch(`/api/test-chat?businessId=${BUSINESS_ID}&phone=${TEST_PHONE}`, { method: 'DELETE' });
    setMessages([]);
  }

  return (
    <div style={{
      maxWidth: 480,
      margin: '0 auto',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0b141a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#1f2c34',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid #2a3942',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 18,
        }}>A</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e9edef', fontWeight: 600, fontSize: 16 }}>Agent Test Chat</div>
          <div style={{ color: '#8696a0', fontSize: 12 }}>
            {loading ? 'agent running...' : 'Simulates new lead via WhatsApp'}
          </div>
        </div>
        <button
          onClick={clearChat}
          style={{
            background: 'none', border: '1px solid #2a3942', borderRadius: 8,
            color: '#8696a0', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
          }}
        >Clear Chat</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 12px',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23ffffff08\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'url(%23p)\'/%3E%3C/svg%3E")',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#8696a0', marginTop: 60, fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>�</div>
            <div style={{ fontWeight: 600, color: '#e9edef', marginBottom: 4 }}>Agent Test Chat</div>
            <div>Runs the REAL agent pipeline.<br/>Messages are intercepted — nothing sent to WhatsApp.</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Type a message as a new lead would.</div>
          </div>
        )}

        {messages.map(msg => (
          msg.role === 'system' ? (
            <div key={msg.id} style={{
              textAlign: 'center', color: '#8696a0', fontSize: 11,
              margin: '4px 0', padding: '2px 8px',
              background: '#1a2328', borderRadius: 6, display: 'inline-block',
              width: '100%',
            }}>
              {msg.content}
            </div>
          ) : (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 4,
          }}>
            <div style={{
              maxWidth: '80%',
              background: msg.role === 'user' ? '#005c4b' : '#1f2c34',
              color: '#e9edef',
              padding: '6px 12px 6px 12px',
              borderRadius: msg.role === 'user' ? '8px 8px 0 8px' : '8px 8px 8px 0',
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              <div style={{ fontSize: 11, color: '#8696a0', textAlign: 'right', marginTop: 2 }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                  <span style={{ marginLeft: 6, color: '#00a884' }}>
                    🔧 {msg.toolsCalled.join(', ')}
                  </span>
                )}
                {msg.stepsUsed != null && (
                  <span style={{ marginLeft: 6, color: '#f0b429' }}>
                    ⚡ {msg.stepsUsed} steps
                  </span>
                )}
              </div>
            </div>
          </div>
          )
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
            <div style={{
              background: '#1f2c34', padding: '10px 16px', borderRadius: '8px 8px 8px 0',
              color: '#8696a0', fontSize: 14,
            }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>●</span>
              <span style={{ animation: 'pulse 1.5s ease-in-out 0.3s infinite' }}>●</span>
              <span style={{ animation: 'pulse 1.5s ease-in-out 0.6s infinite' }}>●</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{
        display: 'flex', gap: 8, padding: '8px 12px',
        background: '#1f2c34', borderTop: '1px solid #2a3942',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          style={{
            flex: 1, background: '#2a3942', border: 'none', borderRadius: 8,
            padding: '10px 14px', color: '#e9edef', fontSize: 15,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: '#00a884', border: 'none', borderRadius: 8,
            padding: '10px 16px', color: 'white', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: 15,
          }}
        >Send</button>
      </form>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}