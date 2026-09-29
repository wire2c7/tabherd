import type { MutableRef } from "preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { rulesItem } from "../../utils/rules/storage";
import type { Rule } from "../../utils/rules/types";

/** ルールの一覧を変更する関数。今の一覧を受け取り、新しい一覧を返す */
export type RulesUpdater = (rules: readonly Rule[]) => Rule[];

/**
 * 保存されたルールの一覧と、それを変更して即座に保存する関数を返す。読み込みが終わるまでは null。
 * ほかの画面（ポップアップとオプションページ）での変更は、ストレージの watch で受け取る
 */
export function useRules(): [rules: readonly Rule[] | null, update: (updater: RulesUpdater) => void] {
  const [rules, setRules] = useState<readonly Rule[] | null>(null);
  // 連続した入力で、前の変更の再描画・保存を待たずに次の変更を組み立てるため、最新の一覧を state とは別に持つ
  const latestRef = useRef<readonly Rule[] | null>(null);
  // 保存中の書き込みの数
  const pendingWritesRef = useRef(0);

  useEffect(() => {
    function apply(value: readonly Rule[]): void {
      latestRef.current = value;
      setRules(value);
    }
    async function load(): Promise<void> {
      const value = await rulesItem.getValue();
      // 読み込みより先に watch で受け取っていれば、そちらが新しい
      if (latestRef.current === null) {
        apply(value);
      }
    }
    const unwatch = rulesItem.watch((value) => {
      // 自分の書き込みを待っているあいだは、手元の一覧の方が新しい。
      // 保存前の値の通知で表示を戻すと、入力中の文字が消えるため無視する
      if (pendingWritesRef.current === 0) {
        apply(value);
      }
    });
    void load();
    return unwatch;
  }, []);

  const update = useCallback((updater: RulesUpdater) => {
    if (latestRef.current === null) {
      return;
    }
    const next = updater(latestRef.current);
    latestRef.current = next;
    setRules(next);
    void saveRules(next, pendingWritesRef);
  }, []);

  return [rules, update];
}

/** ルールの一覧を保存する。保存が終わるまで pendingWrites を増やしておく */
async function saveRules(rules: Rule[], pendingWrites: MutableRef<number>): Promise<void> {
  pendingWrites.current += 1;
  try {
    await rulesItem.setValue(rules);
  } catch (error) {
    console.error("ルールを保存できませんでした", error);
  } finally {
    pendingWrites.current -= 1;
  }
}
