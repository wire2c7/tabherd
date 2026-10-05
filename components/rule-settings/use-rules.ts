import type { MutableRef } from "preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { ParsedRules } from "../../utils/rules/parse";
import type { RulesStore } from "../../utils/rules/storage";
import type { Rule } from "../../utils/rules/types";

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
 * ほかの画面（ポップアップとオプションページ）での変更は、ストレージの watch で受け取る
 */
export function useRules(store: RulesStore): RulesState {
  const [rules, setRules] = useState<readonly Rule[] | null>(null);
  const [isDamaged, setIsDamaged] = useState(false);
  // 連続した入力で、前の変更の再描画・保存を待たずに次の変更を組み立てるため、最新の一覧を state とは別に持つ
  const latestRef = useRef<readonly Rule[] | null>(null);
  // 保存中の書き込みの数
  const pendingWritesRef = useRef(0);

  useEffect(() => {
    // 保存先が替わったら、新しい保存先から読み込んだ一覧を捨てないよう、前の保存先の一覧を忘れる
    latestRef.current = null;
    function apply({ rules: value, damage }: ParsedRules): void {
      latestRef.current = value;
      setRules(value);
      setIsDamaged(damage !== null);
    }
    async function load(): Promise<void> {
      const value = await store.read();
      // 読み込みより先に watch で受け取っていれば、そちらが新しい
      if (latestRef.current === null) {
        apply(value);
      }
    }
    const unwatch = store.watch((value) => {
      // 自分の書き込みを待っているあいだは、手元の一覧の方が新しい。
      // 保存前の値の通知で表示を戻すと、入力中の文字が消えるため無視する
      if (pendingWritesRef.current === 0) {
        apply(value);
      }
    });
    void load();
    return unwatch;
  }, [store]);

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
