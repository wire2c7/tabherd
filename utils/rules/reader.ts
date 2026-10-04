import type { Logger } from "@logtape/logtape";

import type { ParsedRules } from "./parse";
import { readRules, watchRules } from "./storage";
import type { Rule } from "./types";

/** バックグラウンドの処理が使う、ルールの一覧の読み込みと購読 */
export interface RulesReader {
  /** 保存されたルールの一覧を、壊れた箇所を直して読む */
  read: () => Promise<Rule[]>;
  /** 保存されたルールの一覧の変更を、壊れた箇所を直して通知する。購読を解除する関数を返す */
  watch: (listener: (newRules: Rule[], oldRules: Rule[]) => void) => () => void;
}

/**
 * 壊れた保存値を読んだら警告のログを残す RulesReader を作る。
 * タブのイベントのたびに読むため、保存するログが同じ警告で埋まらないよう、壊れていない値を読むまでは警告を繰り返さない
 */
export function createRulesReader(logger: Logger): RulesReader {
  let hasWarned = false;

  function usable({ rules, damage }: ParsedRules): Rule[] {
    if (damage === null) {
      hasWarned = false;
    } else if (!hasWarned) {
      hasWarned = true;
      logger.warn(
        "保存されたルールが壊れていたため、読める部分だけを使います（配列でない: {notArray}、除いたルール {droppedRules} 件、直したルール {repairedRules} 件）",
        { ...damage },
      );
    }
    return rules;
  }

  return {
    read: async () => usable(await readRules()),
    // 警告は今の保存値についてだけ出す
    watch: (listener) => watchRules((newRules, oldRules) => listener(usable(newRules), oldRules.rules)),
  };
}
