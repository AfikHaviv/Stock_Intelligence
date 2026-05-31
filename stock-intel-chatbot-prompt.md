# Claude Code Prompt — Stock Intel AI Chatbot Feature

## Project Context

I have a full-stack stock intelligence dashboard called **Stock Intel**. Here is the full project structure and tech stack:

**Stack:**
- Backend: Node.js + TypeScript 5, Fastify 5, PostgreSQL 14+
- Frontend: Next.js 16 (App Router), Tailwind CSS 4
- External APIs already integrated: Twelve Data, Marketaux, Finnhub, OpenAI (`gpt-4o-mini`)
- The project already calls OpenAI for per-article news sentiment via a `fetchNewsSentiment()` function in `api/src/services/stockService.ts`
- The project already has `getStats()`, `getNewsSentiment()`, and `getRecommendations()` service functions

**Project structure (relevant parts):**
```
Stock_Intel/
├── api/src/
│   ├── index.ts                 ← Fastify server entry
│   ├── routes/stocks.ts         ← All HTTP routes
│   └── services/stockService.ts ← All business logic + OpenAI calls
├── frontend/src/
│   ├── app/page.tsx             ← Root page, owns all state
│   └── components/              ← All UI components
```

---

## Feature to Build

Add a **floating AI chatbot** to the dashboard. When the user clicks a floating button in the bottom-right corner, a side panel slides in from the right where they can have a **multi-turn conversation** about the currently viewed stock. The AI is grounded with live stock data injected into its system prompt on every request.

---

## Detailed Requirements

### Backend — New Route

Add `POST /api/stocks/:ticker/chat` to `api/src/routes/stocks.ts`.

**Request body shape:**
```ts
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}
```

**What the handler must do:**

1. Validate `:ticker` with the existing ticker regex already used in other routes: `/^[A-Za-z0-9]{1,10}(\.[A-Za-z]{1,4})?$/`

2. Fetch stock context in **parallel** using already-existing service functions:
```ts
const [stats, sentimentData, recommendations] = await Promise.all([
  getStats(ticker),
  getNewsSentiment(ticker),
  getRecommendations(ticker),
]);
```

3. Build a system prompt that injects all fetched data. Use this exact structure:
```
You are an expert stock analyst assistant for ${ticker} (${stats.name}).
Your job is to help the user understand this stock using only the data provided below.
Today's date is ${new Date().toISOString().split('T')[0]}.

=== PRICE & STATS ===
Last Close: ${stats.close} ${stats.currency}
Open: ${stats.open}
52-Week High: ${stats.week52High}
52-Week Low: ${stats.week52Low}
Total Volume: ${stats.volume}

=== ANALYST CONSENSUS ===
Strong Buy: ${rec.strongBuy} | Buy: ${rec.buy} | Hold: ${rec.hold} | Sell: ${rec.sell} | Strong Sell: ${rec.strongSell}

=== AI NEWS SENTIMENT ===
Overall Sentiment: ${sentiment.label} (Confidence: ${sentiment.score}/100)
Summary: ${sentiment.summary}

=== RECENT HEADLINES (last 60 days) ===
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.source} (${h.published_at})`).join('\n')}

=== INSTRUCTIONS ===
- Answer questions about this stock concisely and factually.
- Base your answers ONLY on the data provided above. Do not invent data.
- If you don't have enough data to answer confidently, say so explicitly.
- NEVER recommend buying, selling, or holding any stock. Always remind the user this is not financial advice.
- Keep responses focused and under 150 words unless a longer answer is clearly needed.
```

4. Call the **OpenAI chat completions API with streaming enabled**. Use the model `gpt-4o-mini`. Construct the messages array as:
```ts
[{ role: 'system', content: systemPrompt }, ...req.body.messages]
```

5. **Stream the response back** using Server-Sent Events (SSE):
   - Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
   - For each streamed chunk, write: `data: ${JSON.stringify({ token: chunkContent })}\n\n`
   - When the stream ends, write: `data: [DONE]\n\n` then call `reply.raw.end()`

6. **Graceful degradation**: if `OPENAI_API_KEY` is not set in the environment, return HTTP 503 with `{ error: 'AI chat is not configured' }` — same pattern used elsewhere in the codebase for optional features.

7. **Error handling**: wrap everything in a try/catch. On error, if streaming has already started, write `data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n` before closing. If streaming hasn't started, return a standard `{ error: message }` JSON response.

---

### Frontend — ChatPanel Component

Create a new file `frontend/src/components/ChatPanel.tsx`.

**Props:**
```ts
interface ChatPanelProps {
  ticker: string;        // currently viewed ticker e.g. "AAPL"
  stockName: string;     // e.g. "Apple Inc."
  isOpen: boolean;
  onClose: () => void;
}
```

**State the component owns:**
```ts
type Message = { role: 'user' | 'assistant'; content: string };

const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isStreaming, setIsStreaming] = useState(false);
```

**Behaviour:**

1. **Reset conversation when ticker changes:**
```ts
useEffect(() => {
  setMessages([]);
  setInput('');
}, [ticker]);
```

2. **Send message function** using `fetch` with a `ReadableStream` to consume SSE:
   - Append the user message to `messages` immediately (optimistic update)
   - Add an empty assistant message to `messages` that will be filled token by token
   - `POST /api/stocks/${ticker}/chat` with `{ messages: [...messages, userMessage] }`
   - Read the response body as a stream, parse each `data: ...` line, extract the `token` field, and append it to the last (assistant) message in state
   - On `[DONE]`, set `isStreaming` to false

3. **Auto-scroll**: use a `useRef` on the messages container and call `scrollIntoView` whenever messages change.

4. **Suggested starter questions** (shown only when `messages` is empty):
   - *"What's driving the recent price movement?"*
   - *"Summarize the analyst outlook for this stock."*
   - *"What are the key risks based on recent news?"*
   - Render these as clickable pill buttons. Clicking one sets it as the input and immediately submits it.

**UI Layout (side panel):**
```
┌─────────────────────────────────────┐
│  💬 Ask about AAPL (Apple Inc.)  [×] │  ← Header with ticker name + close button
├─────────────────────────────────────┤
│  ⚠️ AI analysis only — not          │  ← Disclaimer banner
│     financial advice                │
├─────────────────────────────────────┤
│                                     │
│  [Suggested questions if empty]     │  ← Starter chips
│                                     │
│  User: What's driving the drop?     │  ← User bubble (right-aligned)
│                                     │
│  AI: Based on recent headlines...   │  ← AI bubble (left-aligned)
│                                     │
│  ● ● ●  (typing indicator)          │  ← Shown while streaming
│                                     │
├─────────────────────────────────────┤
│  [Type a question...        ] [Send]│  ← Input row
└─────────────────────────────────────┘
```

**Styling rules:**
- Panel width: `w-96` (384px), full viewport height, fixed position, right-0, top-0, z-50
- Slide-in animation: use a Tailwind `translate-x` transition — `translate-x-0` when open, `translate-x-full` when closed
- User messages: right-aligned, rounded bubble with a distinct background (e.g. `bg-blue-600 text-white`)
- AI messages: left-aligned, rounded bubble with a muted background that respects dark/light theme
- Typing indicator: three animated dots using a CSS pulse/bounce animation
- The panel must be **fully theme-aware** — use CSS variables or Tailwind dark mode classes consistent with the rest of the app
- Add a semi-transparent dark backdrop overlay behind the panel on mobile

---

### Frontend — Floating Button & Integration in `page.tsx`

In `app/page.tsx`:

1. Add two new state variables:
```ts
const [chatOpen, setChatOpen] = useState(false);
const [activeStockName, setActiveStockName] = useState('');
```

2. Set `activeStockName` when a stock is loaded (you'll know where this happens from reading the existing code).

3. Render the `ChatPanel` component (conditionally — only when a ticker is active):
```tsx
{activeTicker && (
  <ChatPanel
    ticker={activeTicker}
    stockName={activeStockName}
    isOpen={chatOpen}
    onClose={() => setChatOpen(false)}
  />
)}
```

4. Render the **floating button** (always visible when a ticker is loaded):
```tsx
{activeTicker && (
  <button
    onClick={() => setChatOpen(true)}
    className="fixed bottom-6 right-6 z-40 flex items-center gap-2 
               rounded-full px-4 py-3 shadow-lg bg-blue-600 text-white
               hover:bg-blue-700 transition-colors"
  >
    💬 Ask about {activeTicker}
  </button>
)}
```

Hide the floating button when the panel is already open (`!chatOpen &&`).

---

## What NOT to Change

- Do not modify the database schema — this feature is entirely stateless on the backend
- Do not change any existing routes or service functions — only add to them
- Do not change the Python indicators service
- Keep the OpenAI model as `gpt-4o-mini` throughout — do not upgrade to a paid model

---

## Definition of Done

- [ ] `POST /api/stocks/:ticker/chat` exists and streams SSE tokens
- [ ] Returns 503 gracefully when `OPENAI_API_KEY` is absent
- [ ] `ChatPanel.tsx` renders correctly in both light and dark themes
- [ ] Conversation resets automatically when the user searches a new ticker
- [ ] Suggested starter questions appear on an empty conversation and submit on click
- [ ] Typing indicator is visible while the AI is responding
- [ ] The floating button is hidden when the panel is open
- [ ] No TypeScript errors (`npm run build` passes in both `api/` and `frontend/`)
