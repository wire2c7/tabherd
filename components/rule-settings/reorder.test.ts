import { describe, expect, it } from "vitest";

import { findDropSlot, slotToIndex } from "./reorder";

describe("差し込む隙間の決定", () => {
  const centers = [10, 30, 50];

  it("先頭のルールの中心より上なら先頭の隙間", () => {
    expect(findDropSlot(centers, 0)).toBe(0);
  });

  it("ルールの中心より下なら、そのルールの下の隙間", () => {
    expect(findDropSlot(centers, 31)).toBe(2);
  });

  it("末尾のルールの中心より下なら末尾の隙間", () => {
    expect(findDropSlot(centers, 100)).toBe(3);
  });
});

describe("隙間から移動後の位置への変換", () => {
  it("移動元より上の隙間は、その番号の位置になる", () => {
    expect(slotToIndex(2, 0)).toBe(0);
  });

  it("移動元より下の隙間は、移動元が抜ける分だけ1つ上の位置になる", () => {
    expect(slotToIndex(0, 3)).toBe(2);
  });

  it("移動元のすぐ上・すぐ下の隙間は、移動元の位置のまま", () => {
    expect(slotToIndex(1, 1)).toBe(1);
    expect(slotToIndex(1, 2)).toBe(1);
  });
});
