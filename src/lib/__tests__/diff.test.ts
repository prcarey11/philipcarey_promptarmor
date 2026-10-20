import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineDiff } from "../diff";

describe("lineDiff", () => {
  it("returns same lines for identical content", () => {
    const result = lineDiff("a\nb\nc", "a\nb\nc");
    assert.equal(result.length, 3);
    assert.ok(result.every((l) => l.type === "same"));
  });

  it("marks added lines", () => {
    const result = lineDiff("a\nb", "a\nb\nc");
    const added = result.filter((l) => l.type === "added");
    assert.equal(added.length, 1);
    assert.equal(added[0].text, "c");
  });

  it("marks removed lines", () => {
    const result = lineDiff("a\nb\nc", "a\nc");
    const removed = result.filter((l) => l.type === "removed");
    assert.equal(removed.length, 1);
    assert.equal(removed[0].text, "b");
  });

  it("handles complete replacement", () => {
    const result = lineDiff("old line", "new line");
    const removed = result.filter((l) => l.type === "removed");
    const added = result.filter((l) => l.type === "added");
    assert.equal(removed.length, 1);
    assert.equal(added.length, 1);
  });

  it("handles empty old text", () => {
    const result = lineDiff("", "new content");
    assert.ok(result.some((l) => l.type === "added"));
  });
});
