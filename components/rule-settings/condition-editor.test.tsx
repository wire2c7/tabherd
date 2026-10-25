// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { Condition } from "../../utils/rules/types";
import { ConditionEditor } from "./condition-editor";

/** コンテナに描画し、テスト終了時に片付ける */
async function renderCondition(
  condition: Condition,
  onChange: (index: number, condition: Condition) => void,
): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  onTestFinished(() => {
    container.remove();
  });
  await act(() => {
    render(
      <ul>
        <ConditionEditor
          condition={condition}
          index={0}
          idPrefix="c0"
          onChange={onChange}
          onRemove={vi.fn<(index: number) => void>()}
        />
      </ul>,
      container,
    );
  });
  return container;
}

/** 対象（URL・タイトル）の選択欄を取得する */
function targetSelect(container: HTMLElement): HTMLSelectElement | null {
  return container.querySelector<HTMLSelectElement>('select[aria-label="条件 1 の対象"]');
}

/** 対象（URL・タイトル）の選択欄の値を変えて change イベントを起こす。選択欄が無ければ何もしない */
async function selectTarget(container: HTMLElement, value: string): Promise<void> {
  await act(() => {
    const select = targetSelect(container);
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

describe("条件の対象（URL・タイトル）の選択", () => {
  it("初期状態は URL が選ばれている", async () => {
    // 前提: target の指定がない条件（既存の保存済みルールと同じ形）
    // 検証: 対象の選択欄は URL を選んでいる
    const container = await renderCondition(
      { type: "contains", value: "" },
      vi.fn<(index: number, condition: Condition) => void>(),
    );
    expect(targetSelect(container)).toHaveProperty("value", "url");
  });

  it('対象をタイトルに変えると、即座に target: "title" で onChange が呼ばれる', async () => {
    // 前提: URL を対象にした条件を表示している
    // 検証: 対象の選択欄でタイトルを選ぶと、target が title に変わった条件で onChange が呼ばれる
    const onChange = vi.fn<(index: number, condition: Condition) => void>();
    const container = await renderCondition({ type: "contains", value: "github.com" }, onChange);

    await selectTarget(container, "title");

    expect(onChange).toHaveBeenCalledWith(0, { type: "contains", value: "github.com", target: "title" });
  });
});
