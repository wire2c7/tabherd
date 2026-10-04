import type { StorageItem, StorageItemDefinition } from "../storage/item";
import type { ParsedRules } from "./parse";
import { parseRules } from "./parse";
import type { Rule } from "./types";

/** ルールの一覧 */
export const RULES_ITEM: StorageItemDefinition<Rule[]> = { key: "local:rules", fallback: [] };

/** 保存したルールの一覧の読み書き */
export interface RulesStore {
  /** 保存されたルールの一覧を、壊れた箇所を直して読む。保存された値は書き換えない */
  read: () => Promise<ParsedRules>;
  /** ルールの一覧を保存する */
  write: (rules: readonly Rule[]) => Promise<void>;
  /** 保存されたルールの一覧の変更を、変更前の一覧とともに、壊れた箇所を直して通知する。購読を解除する関数を返す */
  watch: (listener: (newRules: ParsedRules, oldRules: ParsedRules) => void) => () => void;
}

/** RULES_ITEM の StorageItem から RulesStore を作る。保存した値の形は確かめずに返るため、読むときは parseRules で直してから渡す */
export function createRulesStore(item: StorageItem<Rule[]>): RulesStore {
  return {
    read: async () => parseRules(await item.getValue()),
    write: async (rules) => item.setValue([...rules]),
    watch: (listener) => item.watch((newValue, oldValue) => listener(parseRules(newValue), parseRules(oldValue))),
  };
}
