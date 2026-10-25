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

/** click() がブラウザ同様に change イベントを発火するよう、document に接続したコンテナを作る */
function connectedContainer(): HTMLDivElement {
  const container = document.createElement("div");
  document.body.append(container);
  onTestFinished(() => {
    container.remove();
  });
  return container;
}

describe("「サスペンド前に確認する」設定のチェックボックス", () => {
  it("初期状態は ON（store が true）で表示する", async () => {
    // 前提: store.read が true を返す / 検証: チェックボックスが checked になる
    const store = fakeStore(true);
    const container = connectedContainer();

    await act(() => {
      render(<SuspendSettings store={store} />, container);
    });
    await vi.waitFor(() => {
      expect(container.querySelector("input")).toHaveProperty("checked", true);
    });
  });

  it("トグルすると store に保存する", async () => {
    // 前提: store が true で初期化 / 検証: チェックボックスを押すと store.write(false) が呼ばれ、表示も外れる
    const store = fakeStore(true);
    const container = connectedContainer();

    await act(() => {
      render(<SuspendSettings store={store} />, container);
    });
    await vi.waitFor(() => {
      expect(container.querySelector("input")).toHaveProperty("checked", true);
    });

    const checkbox = container.querySelector("input");
    await act(() => {
      checkbox?.click();
    });

    await vi.waitFor(() => {
      expect(store.write).toHaveBeenCalledWith(false);
    });
    expect(container.querySelector("input")).toHaveProperty("checked", false);
  });
});
