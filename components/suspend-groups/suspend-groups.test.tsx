// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import type { SuspendTabGroup, SuspendTabsApi } from "../../utils/suspend/tabs";
import { SuspendGroups } from "./suspend-groups";

function fakeConfirmStore(): SuspendConfirmStore {
  return {
    read: vi.fn<SuspendConfirmStore["read"]>().mockResolvedValue(true),
    write: vi.fn<SuspendConfirmStore["write"]>(),
    watch: vi.fn<SuspendConfirmStore["watch"]>(),
  };
}

const GROUPS: SuspendTabGroup[] = [
  { id: 1, windowId: 10, title: "開発", color: "blue", tabs: [{ id: 100, pinned: false, active: false }] },
  { id: 2, windowId: 10, title: undefined, color: "grey", tabs: [{ id: 200, pinned: false, active: false }] },
];

function fakeApi(): SuspendTabsApi {
  return {
    queryWindowGroups: vi.fn<SuspendTabsApi["queryWindowGroups"]>().mockResolvedValue(GROUPS),
    discardTabs: vi.fn<SuspendTabsApi["discardTabs"]>(),
  };
}

describe("タブグループ一覧の表示", () => {
  it("手動作成したグループ（タイトルが無い）を含む一覧を表示する", async () => {
    // 前提: queryWindowGroups がタイトル付きのグループとタイトル無し（手動作成）のグループを返す
    // 検証: どちらのグループ名もコンテナに表示される
    const api = fakeApi();
    const confirmStore = fakeConfirmStore();
    const container = document.createElement("div");

    await act(() => {
      render(<SuspendGroups api={api} confirmStore={confirmStore} />, container);
    });

    // queryWindowGroups の解決と、それに続く setState・再描画が終わるまで待つ
    await vi.waitFor(() => {
      expect(container.textContent).toContain("開発");
    });
    expect(container.textContent).toContain("名前なしのグループ");
  });
});
