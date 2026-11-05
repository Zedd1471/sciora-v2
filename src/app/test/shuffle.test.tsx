import { describe, it, expect } from "vitest";

// Replicate the shuffleArray function from the test page
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

describe("shuffleArray", () => {
  it("should shuffle an array", () => {
    const array = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray([...array]);
    expect(shuffled).toHaveLength(array.length);
    // Verify all elements are present (order may change)
    const sorted = [...shuffled].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5]);
  });

  it("should not modify the original array", () => {
    const array = [1, 2, 3];
    const original = [...array];
    shuffleArray(array);
    expect(array).toEqual(original);
  });

  it("should return empty array for empty input", () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it("should return same single element", () => {
    expect(shuffleArray([1])).toEqual([1]);
  });
});