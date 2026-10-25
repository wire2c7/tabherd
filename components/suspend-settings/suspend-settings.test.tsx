// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import { SuspendSettings } from "./suspend-settings";

function fakeStore(initial: boolean): SuspendConfirmStore {
  let value = initial;
  return {
    read: vi.fn<SuspendConfirmStore["read"]>(async () => {
      await Promise.resolve();
      return value;
    }),
    write: vi.fn<SuspendConfirmStore["write"]>(async (next) => {
      await Promise.resolve();
      value = next;
    }),
    watch: vi.fn<SuspendConfirmStore["watch"]>(),
  };
}

/**
 * click() がブラウザ同様に change イベントを発火するよう、document に接続したコンテナに描画し、
 * 初期状態（store.read の値）の表示まで待つ。
 */
async function renderAndWaitChecked(store: SuspendConfirmStore, checked: boolean): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.append(container);
  onTestFinished(() => {
    container.remove();
  });
  await act(() => {
    render(<SuspendSettings store={store} />, container);
  });
  await vi.waitFor(() => {
    expect(container.querySelector("input")).toHaveProperty("checked", checked);
  });
  return container;
}

describe("「サスペンド前に確認する」設定のチェックボックスの初期表示", () => {
  it("初期状態は ON（store が true）で表示する", async () => {
    // 前提: store.read が true を返す / 検証: チェックボックスが checked になる
    const container = await renderAndWaitChecked(fakeStore(true), true);
    expect(container.querySelector("input")).toHaveProperty("checked", true);
  });
});

describe("「サスペンド前に確認する」設定のチェックボックスのトグル", () => {
  it("トグルすると store に保存する", async () => {
    // 前提: store が true で初期化 / 検証: チェックボックスを押すと store.write(false) が呼ばれ、表示も外れる
    const store = fakeStore(true);
    const container = await renderAndWaitChecked(store, true);

    await act(() => {
      container.querySelector("input")?.click();
    });

    await vi.waitFor(() => {
      expect(store.write).toHaveBeenCalledWith(false);
    });
    expect(container.querySelector("input")).toHaveProperty("checked", false);
  });

  it("保存に失敗したら表示を元に戻す", async () => {
    // 前提: store.write が失敗する / 検証: チェックボックスは一度外れた後、元の状態（checked）に戻る
    const store = fakeStore(true);
    vi.mocked(store.write).mockRejectedValue(new Error("保存に失敗しました"));
    const container = await renderAndWaitChecked(store, true);

    await act(() => {
      container.querySelector("input")?.click();
    });

    await vi.waitFor(() => {
      expect(store.write).toHaveBeenCalledWith(false);
    });
    await vi.waitFor(() => {
      expect(container.querySelector("input")).toHaveProperty("checked", true);
    });
  });
});
