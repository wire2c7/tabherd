import type { StorageItem, StorageItemDefinition } from "../storage/item";
import type { ParsedRules } from "./parse";
import { parseRuleTitles, parseRules } from "./parse";
import type { Rule, RuleTitles } from "./types";

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

/**
 * RULES_ITEM の StorageItem から RulesStore を作る。
 *
 * @param item - 保存先の StorageItem
 * @returns 保存したルールの一覧の読み書き
 * @remarks 保存した値の形は確かめずに返るため、読むときは parseRules で直してから渡す
 */
export function createRulesStore(item: StorageItem<Rule[]>): RulesStore {
  return {
    read: async () => parseRules(await item.getValue()),
    write: async (rules) => item.setValue([...rules]),
    watch: (listener) => item.watch((newValue, oldValue) => listener(parseRules(newValue), parseRules(oldValue))),
  };
}

/** ルールが持っているグループのタイトル。ルールの ID をキーにしたオブジェクトで保存する。書くのは background だけ */
export const RULE_TITLES_ITEM: StorageItemDefinition<Record<string, string>> = {
  key: "local:ruleGroupTitles",
  fallback: {},
};

/** 保存した RuleTitles の読み書き */
export interface RuleTitlesStore {
  /** 保存された RuleTitles を読む。壊れていれば空とみなす */
  read: () => Promise<RuleTitles>;
  write: (titles: RuleTitles) => Promise<void>;
  /** 保存された RuleTitles の変更を通知する。購読を解除する関数を返す */
  watch: (listener: (titles: RuleTitles) => void) => () => void;
}

/**
 * RULE_TITLES_ITEM の StorageItem から RuleTitlesStore を作る。
 *
 * @param item - 保存先の StorageItem
 * @returns 保存した RuleTitles の読み書き
 */
export function createRuleTitlesStore(item: StorageItem<Record<string, string>>): RuleTitlesStore {
  return {
    read: async () => parseRuleTitles(await item.getValue()),
    write: async (titles) => item.setValue(Object.fromEntries(titles)),
    watch: (listener) => item.watch((newValue) => listener(parseRuleTitles(newValue))),
  };
}
