import { describe, expect, it } from "vitest";

import { buildGroupViews } from "./groups";

describe("タブグループ一覧の表示用情報の組み立て", () => {
  it("タブ数と、アクティブ・ピン留めを除いた対象タブ数を算出する", () => {
    // 前提: id 1 のグループは非アクティブ・非ピン留めが1件とアクティブが1件 / 検証: tabCount は2、targetTabIds は非アクティブの1件だけ
    const views = buildGroupViews([
      {
        id: 1,
        windowId: 10,
        title: "開発",
        color: "blue",
        tabs: [
          { id: 100, pinned: false, active: false },
          { id: 101, pinned: false, active: true },
        ],
      },
    ]);
    expect(views).toStrictEqual([{ id: 1, title: "開発", color: "blue", tabCount: 2, targetTabIds: [100] }]);
  });

  it("手動作成したグループ（タイトルが無い）には既定のタイトルを表示する", () => {
    // 前提: title が undefined のグループ / 検証: 「名前なしのグループ」が表示される
    const views = buildGroupViews([{ id: 2, windowId: 10, title: undefined, color: "grey", tabs: [] }]);
    expect(views).toStrictEqual([{ id: 2, title: "名前なしのグループ", color: "grey", tabCount: 0, targetTabIds: [] }]);
  });
});
