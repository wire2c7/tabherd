import type { MutableRef } from "preact/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { RuleProblem } from "../../utils/rules/match";
import { findRuleProblems } from "../../utils/rules/match";
import type { ParsedRules } from "../../utils/rules/parse";
import type { RuleTitlesStore, RulesStore } from "../../utils/rules/storage";
import type { Rule, RuleTitles } from "../../utils/rules/types";
import { NO_TITLES } from "../../utils/rules/types";

/** ルールの一覧を変更する関数。今の一覧を受け取り、新しい一覧を返す */
export type RulesUpdater = (rules: readonly Rule[]) => Rule[];

/** useRules の戻り値 */
export interface RulesState {
  /** 保存されたルールの一覧。壊れた箇所は直してある。読み込みが終わるまでは null */
  rules: readonly Rule[] | null;
  /** 表示している一覧が、壊れた保存値を直したものか。変更して保存し終えると false になる */
  isDamaged: boolean;
  /** 一覧を変更して即座に保存する */
  update: (updater: RulesUpdater) => void;
}

/**
 * store に保存されたルールの一覧と、それを変更して即座に保存する関数を返す。
 * 壊れた保存値は直して表示するが、書き戻すのは利用者が変更したときだけにする。
 * ほかの画面（ポップアップとオプションページ）での変更は、ストレージの watch で受け取る。
 * store は描画のあいだ替わらない前提（替えたいときは呼び出し側がコンポーネントに key を付けて作り直す）
 */
export function useRules(store: RulesStore): RulesState {
  const [rules, setRules] = useState<readonly Rule[] | null>(null);
  const [isDamaged, setIsDamaged] = useState(false);
  // 連続した入力で、前の変更の再描画・保存を待たずに次の変更を組み立てるため、最新の一覧を state とは別に持つ
  const latestRef = useRef<readonly Rule[] | null>(null);
  // 保存中の書き込みの数
  const pendingWritesRef = useRef(0);

  useEffect(
    () =>
      subscribeRules(store, {
        latest: latestRef,
        pendingWrites: pendingWritesRef,
        onChange: ({ rules: value, damage }) => {
          setRules(value);
          setIsDamaged(damage !== null);
        },
      }),
    [store],
  );

  const update = useCallback(
    (updater: RulesUpdater) => {
      if (latestRef.current === null) {
        return;
      }
      const next = updater(latestRef.current);
      latestRef.current = next;
      setRules(next);
      // 保存できなければ、ストレージには壊れた値が残っているため、警告を消さない
      void saveRules(store, next, { pendingWrites: pendingWritesRef, onSaved: () => setIsDamaged(false) });
    },
    [store],
  );

  return { rules, isDamaged, update };
}

interface RulesSubscription {
  /** 最新の一覧。読み込み・変更の通知で書き換える */
  latest: MutableRef<readonly Rule[] | null>;
  /** 保存中の書き込みの数。0 でないあいだの通知は無視する */
  pendingWrites: MutableRef<number>;
  /** 読み込んだ・変わった一覧を受け取る */
  onChange: (parsed: ParsedRules) => void;
}

/** store の一覧を読み込み、変更を購読する。購読をやめる関数を返す */
function subscribeRules(store: RulesStore, { latest, pendingWrites, onChange }: RulesSubscription): () => void {
  function apply(parsed: ParsedRules): void {
    latest.current = parsed.rules;
    onChange(parsed);
  }
  async function load(): Promise<void> {
    try {
      const value = await store.read();
      // 読み込みより先に watch で受け取っていれば、そちらが新しい
      if (latest.current === null) {
        apply(value);
      }
    } catch (error) {
      console.error("ルールの一覧を読み込めませんでした", error);
    }
  }
  const unwatch = store.watch((value) => {
    // 自分の書き込みを待っているあいだは、手元の一覧の方が新しい。
    // 保存前の値の通知で表示を戻すと、入力中の文字が消えるため無視する
    if (pendingWrites.current === 0) {
      apply(value);
    }
  });
  void load();
  return unwatch;
}

interface SaveOptions {
  /** 保存中の書き込みの数。保存が終わるまで増やしておく */
  pendingWrites: MutableRef<number>;
  /** 保存できたときに、pendingWrites を戻した後で呼ぶ */
  onSaved: () => void;
}

/** ルールの一覧を保存する */
async function saveRules(store: RulesStore, rules: Rule[], { pendingWrites, onSaved }: SaveOptions): Promise<void> {
  pendingWrites.current += 1;
  let saved = false;
  try {
    await store.write(rules);
    saved = true;
  } catch (error) {
    console.error("ルールを保存できませんでした", error);
  } finally {
    pendingWrites.current -= 1;
  }
  if (saved) {
    onSaved();
  }
}

/**
 * ルールが持っているグループのタイトルを返す。background が反映のたびに書き直すため、変更を watch で受け取る。
 * 読み込みが終わるまでは null。読めなかったときは、どのルールもタイトルを持っていないものとする。
 * store は描画のあいだ替わらない前提（替えたいときは呼び出し側がコンポーネントに key を付けて作り直す）
 */
export function useRuleTitles(store: RuleTitlesStore): RuleTitles | null {
  const [titles, setTitles] = useState<RuleTitles | null>(null);
  useEffect(() => {
    // 読み込みより先に watch で受け取っていれば、そちらが新しい
    let received = false;
    const unwatch = store.watch((value) => {
      received = true;
      setTitles(value);
    });
    void (async () => {
      try {
        const value = await store.read();
        if (!received) {
          setTitles(value);
        }
      } catch (error) {
        console.error("ルールが持っているグループのタイトルを読み込めませんでした", error);
        if (!received) {
          setTitles(NO_TITLES);
        }
      }
    })();
    return unwatch;
  }, [store]);
  return titles;
}

/**
 * 表示するルールの問題。重複はルールが持っているタイトルで決まるため、記録を読み込むまでは出さない
 * （読み込む前に一覧で上のルールを優先して判定すると、エラーが別のルールへ移って見える）
 */
function findProblemsToShow(rules: readonly Rule[], titles: RuleTitles | null): (RuleProblem | null)[] {
  if (titles === null) {
    return findRuleProblems(rules).map((problem) => (problem === "duplicate-name" ? null : problem));
  }
  return findRuleProblems(rules, titles);
}

/** ルールが持っているグループのタイトル（読み込むまでは null）と、rules のそれぞれの表示する問題を返す */
export function useRuleProblems(
  store: RuleTitlesStore,
  rules: readonly Rule[] | null,
): { titles: RuleTitles | null; problems: (RuleProblem | null)[] } {
  const titles = useRuleTitles(store);
  const problems = useMemo(() => (rules === null ? [] : findProblemsToShow(rules, titles)), [rules, titles]);
  return { titles, problems };
}
