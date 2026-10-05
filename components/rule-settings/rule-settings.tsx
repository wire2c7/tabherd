import type { JSX, RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { findRuleProblems } from "../../utils/rules/match";
import type { RuleTitlesStore, RulesStore } from "../../utils/rules/storage";
import type { Rule, RuleTitles } from "../../utils/rules/types";

import { addRule, moveRule, removeRule, updateRule } from "./edit";
import type { MoveDirection } from "./reorder";
import { RuleEditor } from "./rule-editor";
import { useDragReorder } from "./use-drag-reorder";
import { useRuleTitles, useRules } from "./use-rules";

import "./rule-settings.css";

interface RuleSettingsProps {
  /** ルールの一覧を読み書きする先 */
  store: RulesStore;
  /** ルールが持っているグループのタイトルの読み込み先。名前が重なったルールのどれが使われるかを決める */
  titlesStore: RuleTitlesStore;
}

/** ルールの設定画面。ポップアップとオプションページの両方で描画する */
export function RuleSettings({ store, titlesStore }: RuleSettingsProps): JSX.Element {
  const { rules, isDamaged, update } = useRules(store);
  const titles = useRuleTitles(titlesStore);
  const [newRuleId, setNewRuleId] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (id: string, updateOne: (rule: Rule) => Rule) => update((current) => updateRule(current, id, updateOne)),
    [update],
  );
  const handleRemove = useCallback((id: string) => update((current) => removeRule(current, id)), [update]);
  const handleMove = useCallback(
    (id: string, to: number) => update((current) => moveRuleTo(current, id, to)),
    [update],
  );

  function handleAdd(): void {
    const id = crypto.randomUUID();
    update((current) => addRule(current, id));
    setNewRuleId(id);
  }

  return (
    <div class="rule-settings">
      <p class="rule-settings__description">
        {
          // JSX のテキストの途中で改行すると半角スペースになり、日本語の句点の後に空白が入るため、1つの文字列にする
          "URL が条件に一致するタブを、ルールのグループ名のタブグループへ自動でまとめます。複数のルールに一致するときは上のルールが優先されます。ルールと同じ名前のタブグループは、手で作ったものもそのルールのグループとして扱います。"
        }
      </p>
      {isDamaged && <DamageWarning />}
      {rules === null ? (
        <p class="hint">読み込み中…</p>
      ) : (
        <RuleList
          rules={rules}
          titles={titles}
          newRuleId={newRuleId}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onMove={handleMove}
        />
      )}
      <div class="rule-settings__footer">
        <button type="button" class="primary" disabled={rules === null} onClick={handleAdd}>
          ＋ ルールを追加
        </button>
      </div>
    </div>
  );
}

/** 保存されたルールが壊れていて、直した一覧を表示しているときの警告 */
function DamageWarning(): JSX.Element {
  return (
    <p class="error" role="alert">
      {
        // JSX のテキストの途中で改行すると半角スペースになるため、1つの文字列にする
        "保存されたルールの一部が壊れていたため、読み込めた内容だけを表示しています。ルールを変更すると、この内容で保存し直します。"
      }
    </p>
  );
}

interface RuleListProps {
  rules: readonly Rule[];
  titles: RuleTitles;
  newRuleId: string | null;
  onUpdate: (id: string, update: (rule: Rule) => Rule) => void;
  onRemove: (id: string) => void;
  /** id のルールを、移動後の位置が to 番目になるよう動かす */
  onMove: (id: string, to: number) => void;
}

/** ルールの一覧。一覧の順が優先度とタブバー上の並びを表す。ハンドルのドラッグと「上へ」「下へ」のボタンで並び替える */
function RuleList({ rules, titles, newRuleId, onUpdate, onRemove, onMove }: RuleListProps): JSX.Element {
  const listRef = useRef<HTMLOListElement>(null);
  const problems = useMemo(() => findRuleProblems(rules, titles), [rules, titles]);
  const ids = useMemo(() => rules.map((rule) => rule.id), [rules]);
  const drag = useDragReorder(listRef, ids, onMove);
  const handleStep = useStepWithFocus(listRef, ids, onMove);

  if (rules.length === 0) {
    return <p class="rule-settings__empty">ルールがありません。「ルールを追加」からルールを作ってください。</p>;
  }
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- ドラッグはマウスでの操作で、キーボードでは各ルールの「上へ」「下へ」のボタンで並び替える
    <ol ref={listRef} class="rule-settings__list" onDragOver={drag.handleDragOver} onDrop={drag.handleDrop}>
      {rules.map((rule, index) => (
        <li
          key={rule.id}
          data-rule-id={rule.id}
          class={itemClass({
            index,
            count: rules.length,
            isDragging: drag.draggingId === rule.id,
            dropSlot: drag.dropSlot,
          })}
        >
          {/* キーボード・支援技術では「上へ」「下へ」のボタンで並び替えるため、ハンドルは読み上げない */}
          <span
            class="drag-handle"
            draggable
            aria-hidden="true"
            title="ドラッグで並び替え"
            onDragStart={(event) => drag.handleDragStart(event, rule.id)}
            onDragEnd={drag.handleDragEnd}
          >
            ⠿
          </span>
          <RuleEditor
            rule={rule}
            problem={problems[index] ?? null}
            isNew={rule.id === newRuleId}
            isFirst={index === 0}
            isLast={index === rules.length - 1}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onStep={handleStep}
          />
        </li>
      ))}
    </ol>
  );
}

function moveRuleTo(rules: readonly Rule[], id: string, to: number): Rule[] {
  return moveRule(
    rules,
    rules.findIndex((rule) => rule.id === id),
    to,
  );
}

interface ItemState {
  index: number;
  count: number;
  isDragging: boolean;
  dropSlot: number | null;
}

/** 一覧の項目のクラス。ドラッグ中のルールと、差し込み先の上下の線を表す */
function itemClass({ index, count, isDragging, dropSlot }: ItemState): string {
  const classes = ["rule-settings__item"];
  if (isDragging) {
    classes.push("is-dragging");
  }
  if (dropSlot === index) {
    classes.push("drop-before");
  }
  if (dropSlot === count && index === count - 1) {
    classes.push("drop-after");
  }
  return classes.join(" ");
}

/**
 * 「上へ」「下へ」のボタンでの移動。移動後の再描画で、移動したルールの同じ向きのボタンにフォーカスを戻す。
 * 先頭・末尾に着いてそのボタンが無効になったときは、もう一方のボタンにフォーカスを移す
 */
function useStepWithFocus(
  listRef: RefObject<HTMLOListElement>,
  ids: readonly string[],
  onMove: (id: string, to: number) => void,
): (id: string, direction: MoveDirection) => void {
  const focusRef = useRef<{ id: string; direction: MoveDirection } | null>(null);

  useEffect(() => {
    const request = focusRef.current;
    if (request === null) {
      return;
    }
    focusRef.current = null;
    const item = listRef.current?.querySelector(`[data-rule-id="${CSS.escape(request.id)}"]`);
    const button =
      item?.querySelector<HTMLButtonElement>(`[data-move="${request.direction}"]:enabled`) ??
      item?.querySelector<HTMLButtonElement>("[data-move]:enabled");
    button?.focus();
  });

  return useCallback(
    (id: string, direction: MoveDirection) => {
      const from = ids.indexOf(id);
      focusRef.current = { id, direction };
      onMove(id, direction === "up" ? from - 1 : from + 1);
    },
    [ids, onMove],
  );
}
