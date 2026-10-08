import type { JSX } from "preact";
import { useCallback, useState } from "preact/hooks";

import type { RuleProblem } from "../../utils/rules/match";
import { countUnusedRules } from "../../utils/rules/match";
import type { RuleTitlesStore, RulesStore } from "../../utils/rules/storage";
import type { Rule, RuleTitles } from "../../utils/rules/types";

import { addRule, moveRule, removeRule, updateRule } from "./edit";
import { RuleListOrStatus } from "./rule-list-status";
import { useRuleProblems, useRules } from "./use-rules";

import "./rule-settings.css";

interface RuleSettingsProps {
  /** ルールの一覧を読み書きする先 */
  store: RulesStore;
  /** ルールが持っているグループのタイトルの読み込み先。名前が重なったルールのどれが使われるかを決める */
  titlesStore: RuleTitlesStore;
}

/**
 * ルールの設定画面。
 *
 * @param props - ルールの一覧とグループのタイトルの読み書き先
 * @returns ルールの設定画面
 * @remarks ポップアップとオプションページの両方で描画する
 */
export function RuleSettings({ store, titlesStore }: RuleSettingsProps): JSX.Element {
  const { load, isDamaged, update, retry } = useRules(store);
  const rules = load.status === "loaded" ? load.rules : null;
  const { titles, problems } = useRuleProblems(titlesStore, rules);
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
      <RuleWarnings isDamaged={isDamaged} rules={rules} titles={titles} problems={problems} />
      <RuleListOrStatus
        load={load}
        rules={rules}
        retry={retry}
        problems={problems}
        newRuleId={newRuleId}
        onUpdate={handleUpdate}
        onRemove={handleRemove}
        onMove={handleMove}
      />
      <div class="rule-settings__footer">
        <button type="button" class="primary" disabled={rules === null} onClick={handleAdd}>
          ＋ ルールを追加
        </button>
      </div>
    </div>
  );
}

interface RuleWarningsProps {
  isDamaged: boolean;
  /** 読み込みが終わるまでは null */
  rules: readonly Rule[] | null;
  /** 読み込みが終わるまでは null */
  titles: RuleTitles | null;
  /** rules のそれぞれの、表示する問題 */
  problems: readonly (RuleProblem | null)[];
}

/**
 * 一覧の上に出す警告。保存されたルールが壊れていたことと、使われないルールの件数。
 * 件数は、一覧が長く、エラーのあるルールが画面の外にあっても気づけるよう出す。
 * 件数の表示は、出たことを読み上げるよう、aria-live の領域を常に置いて中身だけを替える
 */
function RuleWarnings({ isDamaged, rules, titles, problems }: RuleWarningsProps): JSX.Element {
  // 重複はタイトルの記録で決まるため、記録を読み込むまで数えない（入力欄の下のエラーと同じ）
  const unusedCount = rules === null || titles === null ? 0 : countUnusedRules(rules, titles, problems);
  return (
    <>
      {isDamaged && <DamageWarning />}
      <div aria-live="polite">
        {unusedCount > 0 && (
          <p class="error">
            {`使われないルールが ${unusedCount} 件あります。エラーが表示されているルールのグループ名を確かめてください。`}
          </p>
        )}
      </div>
    </>
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

function moveRuleTo(rules: readonly Rule[], id: string, to: number): Rule[] {
  return moveRule(
    rules,
    rules.findIndex((rule) => rule.id === id),
    to,
  );
}
