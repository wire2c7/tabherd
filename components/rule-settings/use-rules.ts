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

/** 保存されたルールの一覧の読み込みの状態。components/log-settings/count.ts の StoredLogCount と同じ形 */
export type RulesLoad =
  | { status: "loading" }
  | { status: "loaded"; rules: readonly Rule[] }
  /** 読み込みに失敗した。retry() でもう一度読み込める */
  | { status: "failed" };

/** useRules の戻り値 */
export interface RulesState {
  /** 保存されたルールの一覧の読み込みの状態。壊れた箇所は直してある */
  load: RulesLoad;
  /** 表示している一覧が、壊れた保存値を直したものか。変更して保存し終えると false になる */
  isDamaged: boolean;
  /** 一覧を変更して即座に保存する。load.status が "loaded" でなければ何もしない */
  update: (updater: RulesUpdater) => void;
  /** 読み込みをもう一度試す */
  retry: () => void;
}

/**
 * store に保存されたルールの一覧と、それを変更して即座に保存する関数を返す。
 *
 * @param store - 保存先の RulesStore
 * @returns 保存されたルールの一覧の読み込みの状態、変更して保存する関数、読み込みをもう一度試す関数
 * @remarks 壊れた保存値は直して表示するが、書き戻すのは利用者が変更したときだけにする。ほかの画面（ポップアップとオプションページ）での変更は、ストレージの watch で受け取る。store は描画のあいだ替わらない前提（替えたいときは呼び出し側がコンポーネントに key を付けて作り直す）
 */
export function useRules(store: RulesStore): RulesState {
  const [load, setLoad] = useState<RulesLoad>({ status: "loading" });
  const [isDamaged, setIsDamaged] = useState(false);
  // 連続した入力で、前の変更の再描画・保存を待たずに次の変更を組み立てるため、最新の一覧を state とは別に持つ
  const latestRef = useRef<readonly Rule[] | null>(null);
  // 保存中の書き込みの数
  const pendingWritesRef = useRef(0);
  // retry から呼び直すため、購読が作った読み込み関数を持っておく。エフェクトの実行前は null（retry は呼ばれない）
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const subscription = subscribeRules(store, {
      latest: latestRef,
      pendingWrites: pendingWritesRef,
      onChange: ({ rules: value, damage }) => {
        setLoad({ status: "loaded", rules: value });
        setIsDamaged(damage !== null);
      },
      onLoadFailed: () => {
        setLoad({ status: "failed" });
      },
    });
    loadRef.current = subscription.load;
    return subscription.unsubscribe;
  }, [store]);

  const update = useCallback(
    (updater: RulesUpdater) => {
      if (latestRef.current === null) {
        return;
      }
      const next = updater(latestRef.current);
      latestRef.current = next;
      setLoad({ status: "loaded", rules: next });
      // 保存できなければ、ストレージには壊れた値が残っているため、警告を消さない
      void saveRules(store, next, { pendingWrites: pendingWritesRef, onSaved: () => setIsDamaged(false) });
    },
    [store],
  );

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    void loadRef.current?.();
  }, []);

  return { load, isDamaged, update, retry };
}

export interface RulesSubscription {
  /** 最新の一覧。読み込み・変更の通知で書き換える */
  latest: MutableRef<readonly Rule[] | null>;
  /** 保存中の書き込みの数。0 でないあいだの通知は無視する */
  pendingWrites: MutableRef<number>;
  /** 読み込んだ・変わった一覧を受け取る */
  onChange: (parsed: ParsedRules) => void;
  /** 読み込みが失敗したことを受け取る。latest がまだ無いときだけ呼ぶ */
  onLoadFailed: () => void;
}

/** store の一覧の読み込みと、購読をやめる関数 */
export interface RulesSubscribed {
  /** store を読み込み直す。retry から呼ぶ */
  load: () => Promise<void>;
  unsubscribe: () => void;
}

/** store の一覧を読み込み、変更を購読する */
export function subscribeRules(
  store: RulesStore,
  { latest, pendingWrites, onChange, onLoadFailed }: RulesSubscription,
): RulesSubscribed {
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
      if (latest.current === null) {
        onLoadFailed();
      }
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
  return { load, unsubscribe: unwatch };
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
 * ルールが持っているグループのタイトルを返す。
 *
 * @param store - 読み込み元の RuleTitlesStore
 * @returns ルールが持っているグループのタイトル。読み込みが終わるまでは null
 * @remarks background が反映のたびに書き直すため、変更を watch で受け取る。読めなかったときは、どのルールもタイトルを持っていないものとする。store は描画のあいだ替わらない前提（替えたいときは呼び出し側がコンポーネントに key を付けて作り直す）
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

/**
 * ルールが持っているグループのタイトル（読み込むまでは null）と、rules のそれぞれの表示する問題を返す。
 *
 * @param store - 読み込み元の RuleTitlesStore
 * @param rules - 問題を判定するルールの一覧。読み込みが終わるまでは null
 * @returns ルールが持っているグループのタイトルと、rules のそれぞれの表示する問題
 */
export function useRuleProblems(
  store: RuleTitlesStore,
  rules: readonly Rule[] | null,
): { titles: RuleTitles | null; problems: (RuleProblem | null)[] } {
  const titles = useRuleTitles(store);
  const problems = useMemo(() => (rules === null ? [] : findProblemsToShow(rules, titles)), [rules, titles]);
  return { titles, problems };
}
