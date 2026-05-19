# token-est

[![ci](https://github.com/p-vbordei/token-est/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/token-est/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/token-est.svg)](https://www.npmjs.com/package/token-est)
[![downloads](https://img.shields.io/npm/dm/token-est.svg)](https://www.npmjs.com/package/token-est)
[![bundle](https://img.shields.io/bundlejs/size/token-est)](https://bundlejs.com/?q=token-est)

> Fast, heuristic token estimator for LLM prompts. Zero dependencies, no 1MB tokenizer download. Within ~15% of a real tokenizer for prose.

```ts
import { estimate, estimateMessages, truncate } from "token-est";

estimate("Hello, world!")              // ~4
estimate(longArticle, { model: "claude" })

estimateMessages([
  { role: "system", content: "You are helpful." },
  { role: "user",   content: "Hi" },
])                                     // includes per-message overhead

const fits = truncate(input, 4096);    // cut at word boundary so it fits
```

## Install

```sh
npm install token-est
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

Real tokenizers (tiktoken, anthropic-tokenizer) work but they ship megabytes of vocabulary data. That's:

- ❌ Too big for edge runtimes (Cloudflare Workers, Vercel Edge)
- ❌ Slow cold-start (parse 1MB of JSON)
- ❌ Annoying for client-side bundles
- ✅ Necessary for billing accuracy, **not** for budgeting and truncation

For UI hints, context-budget management, and pre-flight checks, you don't need exact — you need *fast and roughly right*. `token-est` is `<1KB`, runs in microseconds, and stays within 15% of real tokenizer counts for typical prose.

## Recipes

### Show "X of N tokens used" in a UI

```ts
import { estimateMessages } from "token-est";

const used = estimateMessages(conversation, { model: "gpt" });
const budget = 8192;
const pct = Math.round((used / budget) * 100);
ui.textContent = `${used} / ${budget} tokens (${pct}%)`;
```

### Truncate before sending

```ts
import { estimate, truncate } from "token-est";

const SYSTEM_PROMPT = "You are a helpful assistant.";
const SYSTEM_TOKENS = estimate(SYSTEM_PROMPT);
const RESPONSE_BUDGET = 1000;

function fitUserMessage(text: string, total = 8192): string {
  const budget = total - SYSTEM_TOKENS - RESPONSE_BUDGET - 10;  // 10 token margin
  return truncate(text, budget);
}
```

### Chunk a long document for RAG

```ts
import { estimate } from "token-est";

function chunk(text: string, maxTokens = 500): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (estimate(current + s) > maxTokens) {
      if (current) chunks.push(current);
      current = s;
    } else {
      current += (current ? " " : "") + s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
```

### Estimate cost before calling

```ts
import { estimateMessages } from "token-est";

const PRICE_PER_1K = 0.005;  // USD per 1k input tokens

const tokens = estimateMessages(messages);
const estimatedCost = (tokens / 1000) * PRICE_PER_1K;

if (estimatedCost > 0.10) {
  if (!confirm(`This call will cost ~$${estimatedCost.toFixed(3)}. Continue?`)) return;
}
```

## When to use this

- ✅ Deciding whether a prompt fits a context window
- ✅ Sizing chunks for retrieval / batching
- ✅ Showing a "tokens used" hint in a UI
- ✅ Triggering summarization before you hit a hard limit
- ❌ Anything billing-related — use the official tokenizer
- ❌ Hard fences around context limits — leave at least 10% margin

## API

### `estimate(text, opts?): number`

| Option | Type | Default |
|---|---|---|
| `model` | `"gpt" \| "claude" \| "generic"` | `"gpt"` |

Returns a positive integer (minimum 1 for non-empty input).

### `estimateMessages(messages, opts?): number`

Estimates total tokens for a chat-style request including per-message overhead.

```ts
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string;
  name?: string;
};
```

- GPT: ~4 tokens per message + 2 for the reply primer
- Claude: ~3 tokens per message

### `truncate(text, maxTokens, opts?): string`

Returns a prefix of `text` whose estimated tokens are `<= maxTokens`. Cuts on a word boundary when feasible (within 80% of the target), otherwise on a character boundary. Returns `""` for `maxTokens <= 0`.

## Accuracy

| Input | Real (GPT-4) | This estimator | Δ |
|---|---|---|---|
| `"Hello, world!"` | 4 | 4 | 0% |
| 1 paragraph of English prose | ~95 | ~100 | +5% |
| 100 lines of code | varies widely | varies widely | ±25% |
| 100 chars of CJK | ~150 | ~150 | ±5% |

Don't use this to enforce hard limits — always leave headroom.

## License

Apache-2.0 © Vlad Bordei
