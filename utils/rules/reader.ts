import type { Logger } from "../logging/logger";
import type { StorageItem, StorageItemDefinition } from "../storage/item";
import type { ParsedRules } from "./parse";
import type { RulesStore } from "./storage";
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
export const DAMAGE_WARNED_ITEM: StorageItemDefinition<boolean> = { key: "session:rulesDamageWarned", fallback: false };

/** warnIfDamaged が持ち越す、damageWarned の値を写したもの。起動してから最初に確かめるまでは undefined */
interface WarnedState {
  hasWarned: boolean | undefined;
  loading: Promise<unknown> | undefined;
}

/**
 * state.hasWarned が未確認（undefined）なら、damageWarned.getValue() で読んで埋める。
 *
 * @remarks 読めなくても警告自体は続けられるよう、失敗はログに残すだけで未確認のまま進む。
 * loading を外すことで、ストレージが直った後の次の呼び出しがもう一度読み直す
 */
async function syncWarnedState(damageWarned: StorageItem<boolean>, logger: Logger, state: WarnedState): Promise<void> {
  if (state.hasWarned !== undefined) {
    return;
  }
  state.loading ??= damageWarned.getValue();
  try {
    const stored = await state.loading;
    // 読み込みを待つあいだに、先に待ち終えた呼び出しが書き換えていれば、そちらが新しい
    state.hasWarned ??= stored === true;
  } catch (error) {
    logger.error("壊れたルールの警告の状態を読めませんでした", { error });
  } finally {
    state.loading = undefined;
  }
}

/** damageWarned.setValue() の失敗をログに残すだけで続ける */
async function trySaveWarnedState(damageWarned: StorageItem<boolean>, logger: Logger, value: boolean): Promise<void> {
  try {
    await damageWarned.setValue(value);
  } catch (error) {
    logger.error("壊れたルールの警告の状態を保存できませんでした", { error });
  }
}

/**
 * 壊れた保存値を読んだら警告のログを残す RulesReader を作る。
 *
 * @param rules - 読み込み元の RulesStore
 * @param damageWarned - 警告を繰り返さないための状態。DAMAGE_WARNED_ITEM の StorageItem
 * @param logger - 警告を残すロガー
 * @returns バックグラウンドの処理が使う RulesReader
 * @remarks タブのイベントのたびに読むため、保存するログが同じ警告で埋まらないよう、壊れていない値を読むまでは警告を繰り返さない
 */
export function createRulesReader(rules: RulesStore, damageWarned: StorageItem<boolean>, logger: Logger): RulesReader {
  const state: WarnedState = { hasWarned: undefined, loading: undefined };

  async function warnIfDamaged({ damage }: ParsedRules): Promise<void> {
    await syncWarnedState(damageWarned, logger, state);
    // 判定と書き換えは await を挟まずに行い、同時に読んだ呼び出しが二重に警告しないようにする
    const warnedBefore = state.hasWarned ?? false;
    if (damage === null) {
      if (warnedBefore) {
        state.hasWarned = false;
        await trySaveWarnedState(damageWarned, logger, false);
      }
    } else if (!warnedBefore) {
      state.hasWarned = true;
      logger.warn(
        "保存されたルールが壊れていたため、読める部分だけを使います（配列でない: {notArray}、除いたルール {droppedRules} 件、直したルール {repairedRules} 件）",
        { ...damage },
      );
      await trySaveWarnedState(damageWarned, logger, true);
    }
  }

  return {
    read: async () => {
      const parsed = await rules.read();
      await warnIfDamaged(parsed);
      return parsed.rules;
    },
    watch: (listener) =>
      rules.watch((newRules, oldRules) => {
        listener(newRules.rules, oldRules.rules);
        // 警告は今の保存値についてだけ出す。warnIfDamaged 自身が読み書きの失敗をログに残して続けるため、ここでは待つだけでよい
        void warnIfDamaged(newRules);
      }),
  };
}
