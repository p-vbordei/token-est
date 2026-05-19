# token-est

[![ci](https://github.com/p-vbordei/token-est/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/token-est/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/token-est.svg)](https://www.npmjs.com/package/token-est)
[![downloads](https://img.shields.io/npm/dm/token-est.svg)](https://www.npmjs.com/package/token-est)
[![bundle](https://img.shields.io/bundlejs/size/token-est)](https://bundlejs.com/?q=token-est)

Fast, heuristic token estimator for LLM prompts. **Zero dependencies, no 1MB tokenizer download.** Typically within ~15% of a real tokenizer for prose — accurate enough for budgeting, batching, and truncation.

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

## When to use this

- ✅ Deciding whether a prompt fits a context window.
- ✅ Sizing chunks for retrieval / batching.
- ✅ Showing a "tokens used" hint in a UI.
- ✅ Triggering summarization before you hit a hard limit.

## When NOT to use this

- ❌ Anything billing-related — use the official tokenizer.
- ❌ Hard fences around context limits — leave at least 10% margin.
- ❌ Heavy code or rare-script input — accuracy drops.

## API

### `estimate(text, opts?): number`

| Option | Type | Default |
|---|---|---|
| `model` | `"gpt" \| "claude" \| "generic"` | `"gpt"` |

Returns a positive integer (minimum 1 for non-empty input).

### `estimateMessages(messages, opts?): number`

Estimates total tokens for a chat-style request including per-message overhead. Each message contributes ~3-4 tokens of framing on top of its content; the GPT family also has a "reply primer" of 2 tokens.

```ts
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string;
  name?: string;
};
```

### `truncate(text, maxTokens, opts?): string`

Returns a prefix of `text` whose estimated tokens are `<= maxTokens`. Cuts on a word boundary when feasible (within 80% of the binary-search target), otherwise on a character boundary. Returns `""` for `maxTokens <= 0`.

## How accurate?

| Input | Real (GPT-4) | This | Δ |
|---|---|---|---|
| `"Hello, world!"` | 4 | 4 | ±0 |
| 1 paragraph of English prose | ~95 | ~100 | +5% |
| 100 lines of code | varies widely | varies widely | ±25% |
| 100 chars of CJK | ~150 | ~150 | ±5% |

Don't use this to enforce hard limits — always leave headroom.

## License

Apache-2.0 © Vlad Bordei
