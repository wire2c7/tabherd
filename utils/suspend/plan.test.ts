import { describe, expect, it } from "vitest";

import { pickSuspendTargets } from "./plan";

describe("サスペンド対象タブの絞り込み", () => {
  it("アクティブタブを除外する", () => {
    // 前提: id 1 は非アクティブ・非ピン留め、id 2 はアクティブ / 検証: id 2 が除外される
    const result = pickSuspendTargets([
      { id: 1, pinned: false, active: false },
      { id: 2, pinned: false, active: true },
    ]);
    expect(result).toStrictEqual([1]);
  });

  it("ピン留めタブを除外する", () => {
    // 前提: id 1 はピン留め、id 2 は非ピン留め・非アクティブ / 検証: id 1 が除外される
    const result = pickSuspendTargets([
      { id: 1, pinned: true, active: false },
      { id: 2, pinned: false, active: false },
    ]);
    expect(result).toStrictEqual([2]);
  });

  it("対象が0件のとき空配列を返す", () => {
    // 前提: すべてアクティブまたはピン留め / 検証: 空配列
    const result = pickSuspendTargets([
      { id: 1, pinned: true, active: false },
      { id: 2, pinned: false, active: true },
    ]);
    expect(result).toStrictEqual([]);
  });
});
