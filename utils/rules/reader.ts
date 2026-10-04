import type { Logger } from "@logtape/logtape";
import { storage } from "wxt/utils/storage";

import type { ParsedRules } from "./parse";
import { readRules, watchRuleChanges } from "./storage";
import type { Rule } from "./types";

/** バックグラウンドの処理が使う、ルールの一覧の読み込みと購読 */
export interface RulesReader {
  /** 保存されたルールの一覧を、壊れた箇所を直して読む */
  read: () => Promise<Rule[]>;
  /** 保存されたルールの一覧の変更を、壊れた箇所を直して通知する。購読を解除する関数を返す */
  watch: (listener: (newRules: Rule[], oldRules: Rule[]) => void) => () => void;
}

/**
 * 壊れたルールの警告を出した後、壊れていない値をまだ読んでいないか。
 * Service Worker は30秒操作が無いと止まり、変数が消えるため、ブラウザを閉じるまで残る storage.session に置く
 */
const damageWarnedItem = storage.defineItem<boolean>("session:rulesDamageWarned", { fallback: false });

/**
 * 壊れた保存値を読んだら警告のログを残す RulesReader を作る。
 * タブのイベントのたびに読むため、保存するログが同じ警告で埋まらないよう、壊れていない値を読むまでは警告を繰り返さない
 */
export function createRulesReader(logger: Logger): RulesReader {
  // damageWarnedItem の値を写したもの。起動してから最初に確かめるまでは undefined
  let hasWarned: boolean | undefined;
  let loading: Promise<boolean> | undefined;

  async function warnIfDamaged({ damage }: ParsedRules): Promise<void> {
    if (hasWarned === undefined) {
      loading ??= damageWarnedItem.getValue();
      const stored = await loading;
      // 読み込みを待つあいだに、先に待ち終えた呼び出しが書き換えていれば、そちらが新しい
      hasWarned ??= stored;
    }
    // 判定と書き換えは await を挟まずに行い、同時に読んだ呼び出しが二重に警告しないようにする
    if (damage === null) {
      if (hasWarned) {
        hasWarned = false;
        await damageWarnedItem.setValue(false);
      }
    } else if (!hasWarned) {
      hasWarned = true;
      logger.warn(
        "保存されたルールが壊れていたため、読める部分だけを使います（配列でない: {notArray}、除いたルール {droppedRules} 件、直したルール {repairedRules} 件）",
        { ...damage },
      );
      await damageWarnedItem.setValue(true);
    }
  }

  return {
    read: async () => {
      const parsed = await readRules();
      await warnIfDamaged(parsed);
      return parsed.rules;
    },
    watch: (listener) =>
      watchRuleChanges((newRules, oldRules) => {
        listener(newRules.rules, oldRules.rules);
        // 警告は今の保存値についてだけ出す
        void (async () => {
          try {
            await warnIfDamaged(newRules);
          } catch (error) {
            logger.error("壊れたルールの警告の状態を保存できませんでした", { error });
          }
        })();
      }),
  };
}
