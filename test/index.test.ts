import { describe, it, expect } from "vitest";
import { estimate, estimateMessages, truncate } from "../src/index.js";

describe("estimate: rough accuracy", () => {
  it("empty string → 0", () => {
    expect(estimate("")).toBe(0);
  });

  it("short ASCII", () => {
    // "Hello, world!" — real GPT count is 4
    const n = estimate("Hello, world!");
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(6);
  });

  it("longer ASCII paragraph", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(10);
    // real ≈ ~95 tokens
    const n = estimate(text);
    expect(n).toBeGreaterThan(70);
    expect(n).toBeLessThan(130);
  });

  it("CJK is denser", () => {
    const cjk = "你好世界这是一个测试";
    const ascii = "Hello world this is a test";
    expect(estimate(cjk)).toBeGreaterThan(estimate(ascii));
  });

  it("monotonic with length", () => {
    const a = estimate("a".repeat(100));
    const b = estimate("a".repeat(200));
    expect(b).toBeGreaterThan(a);
  });

  it("different models give slightly different counts", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const gpt = estimate(text, { model: "gpt" });
    const claude = estimate(text, { model: "claude" });
    expect(Math.abs(gpt - claude)).toBeLessThanOrEqual(5);
  });
});

describe("estimateMessages", () => {
  it("adds per-message overhead", () => {
    const single = estimateMessages([{ role: "user", content: "hello" }]);
    const empty = estimateMessages([]);
    expect(single).toBeGreaterThan(empty);
  });
  it("more messages = more tokens", () => {
    const one = estimateMessages([{ role: "user", content: "hi" }]);
    const three = estimateMessages([
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello!" },
    ]);
    expect(three).toBeGreaterThan(one);
  });
  it("name adds overhead", () => {
    const a = estimateMessages([{ role: "tool", content: "result" }]);
    const b = estimateMessages([{ role: "tool", content: "result", name: "search" }]);
    expect(b).toBeGreaterThan(a);
  });
});

describe("truncate", () => {
  it("returns full text when under limit", () => {
    expect(truncate("hello", 100)).toBe("hello");
  });

  it("cuts on word boundary when possible", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(20);
    const out = truncate(text, 10);
    expect(estimate(out)).toBeLessThanOrEqual(10);
    expect(out.endsWith(" ")).toBe(false);
  });

  it("returns empty for zero or negative max", () => {
    expect(truncate("hello", 0)).toBe("");
    expect(truncate("hello", -1)).toBe("");
  });

  it("result actually fits the budget", () => {
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);
    for (const max of [5, 20, 50, 100, 200]) {
      expect(estimate(truncate(text, max))).toBeLessThanOrEqual(max);
    }
  });
});
