export type ModelFamily = "gpt" | "claude" | "generic";

export interface EstimateOptions {
  /** Tuning per model family. Default `"gpt"`. */
  model?: ModelFamily;
}

interface CharBreakdown {
  ascii: number;
  cjk: number;
  other: number;
  whitespace: number;
}

function countChars(text: string): CharBreakdown {
  let ascii = 0;
  let cjk = 0;
  let other = 0;
  let whitespace = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0D) {
      whitespace++;
    } else if (code >= 0x21 && code <= 0x7E) {
      ascii++;
    } else if (
      (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
      (code >= 0x3040 && code <= 0x30FF) ||   // Hiragana + Katakana
      (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) ||   // CJK compatibility
      (code >= 0x20000 && code <= 0x2FFFF)    // CJK extensions
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return { ascii, cjk, other, whitespace };
}

const FACTORS: Record<ModelFamily, { ascii: number; cjk: number; other: number; whitespace: number; baseline: number }> = {
  // Tuned against published tokenizer behaviour. These are rough — within ±15%
  // for typical prose, code, and mixed-language input. Don't use these for billing.
  gpt:     { ascii: 1 / 3.6, cjk: 1.5, other: 1 / 2.2, whitespace: 1 / 8, baseline: 0 },
  claude:  { ascii: 1 / 3.4, cjk: 1.3, other: 1 / 2.5, whitespace: 1 / 8, baseline: 0 },
  generic: { ascii: 1 / 3.5, cjk: 1.4, other: 1 / 2.3, whitespace: 1 / 8, baseline: 0 },
};

/**
 * Estimate the number of tokens in `text` for a given model family.
 *
 * **Heuristic, not exact.** Use it for budgeting, batching, and truncation —
 * not for billing or hard limits. Typically within 15% of the real tokenizer
 * for prose; less accurate for code-heavy text or unusual scripts.
 */
export function estimate(text: string, opts: EstimateOptions = {}): number {
  if (typeof text !== "string" || !text) return 0;
  const f = FACTORS[opts.model ?? "gpt"];
  const c = countChars(text);
  const raw = c.ascii * f.ascii + c.cjk * f.cjk + c.other * f.other + c.whitespace * f.whitespace + f.baseline;
  return Math.max(1, Math.ceil(raw));
}

/* ---- Chat helpers ---- */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string;
  name?: string;
}

/**
 * Estimate tokens for a list of chat messages, accounting for per-message
 * overhead (role tags, separators). Provider-specific overheads:
 *
 * - GPT: ~4 tokens per message + 2 for the reply primer
 * - Claude: ~3 tokens per message
 */
export function estimateMessages(messages: readonly ChatMessage[], opts: EstimateOptions = {}): number {
  const model = opts.model ?? "gpt";
  const perMessage = model === "claude" ? 3 : 4;
  const replyPrimer = model === "claude" ? 0 : 2;
  let total = replyPrimer;
  for (const m of messages) {
    total += perMessage;
    total += estimate(m.content, opts);
    if (m.name) total += estimate(m.name, opts);
  }
  return total;
}

/**
 * Truncate `text` so its estimated token count does not exceed `maxTokens`.
 * Cuts on a word boundary when possible.
 */
export function truncate(text: string, maxTokens: number, opts: EstimateOptions = {}): string {
  if (maxTokens <= 0) return "";
  if (estimate(text, opts) <= maxTokens) return text;
  // Coarse-to-fine: binary search on character count.
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (estimate(text.slice(0, mid), opts) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }
  // Try to cut on a word boundary, but don't go shorter than 80% of `lo`.
  const slice = text.slice(0, lo);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= lo * 0.8) return slice.slice(0, lastSpace);
  return slice;
}
