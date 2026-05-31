'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Message = { role: 'user' | 'assistant'; content: string };

interface ChatPanelProps {
  ticker: string;
  stockName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CONTEXT_WINDOW = 20;  // messages sent to the AI per request
const SESSION_CAP    = 100; // total messages stored before blocking new input

const STARTER_QUESTIONS = [
  "What's driving the recent price movement?",
  'Summarize the analyst outlook for this stock.',
  'What are the key risks based on recent news?',
];

export default function ChatPanel({ ticker, stockName, isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [ticker]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || messages.length >= SESSION_CAP) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const outgoing = [...messages, userMessage];
    setMessages([...outgoing, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    // Trim to the last CONTEXT_WINDOW messages before sending to the API
    const contextMessages = outgoing.slice(-CONTEXT_WINDOW);

    try {
      const res = await fetch(`${API_URL}/api/stocks/${ticker}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'Failed to get a response. Please try again.' };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(data) as { token?: string; error?: string };
            if (parsed.token) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + parsed.token };
                }
                return next;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant' && !last.content) {
                  next[next.length - 1] = { ...last, content: 'Stream error. Please try again.' };
                }
                return next;
              });
              setIsStreaming(false);
              return;
            }
          } catch { /* ignore JSON parse errors */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: 'Network error. Please try again.' };
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, ticker, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Side panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-96 z-50 flex flex-col
          bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700
          shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-blue-500">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ask about <span className="text-blue-500">{ticker}</span>
            </span>
            {stockName && (
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                {stockName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40 flex-shrink-0">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            AI analysis only — not financial advice. Data may be delayed.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
                Ask anything about {ticker} based on live data.
              </p>
              <div className="flex flex-col gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                      text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800
                      hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-700
                      transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                    }`}
                >
                  {msg.content || (msg.role === 'assistant' && isStreaming && i === messages.length - 1 ? null : '…')}
                  {msg.role === 'assistant' && isStreaming && i === messages.length - 1 && !msg.content && (
                    <span className="inline-flex gap-1 items-center py-0.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator shown after last message while streaming and last message has content */}
          {isStreaming && messages.length > 0 && messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <span className="inline-flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          {messages.length >= SESSION_CAP ? (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-1">
              Session limit reached. Search a new ticker to start fresh.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this stock…"
                disabled={isStreaming}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600
                  bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                  placeholder-slate-400 dark:placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                  hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
