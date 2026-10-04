import { storage } from "wxt/utils/storage";

import type { ParsedRules } from "./parse";
import { parseRules } from "./parse";
import type { Rule } from "./types";

/**
 * ルールの一覧。データの形を変えるときは version を上げて migrations を書く。
 * 保存した値の形は確かめずに返るため、外へは出さず、読むときは readRules・watchRules で直してから渡す
 */
const rulesItem = storage.defineItem<Rule[]>("local:rules", {
  fallback: [],
  version: 1,
});

/** 保存されたルールの一覧を、壊れた箇所を直して読む。保存された値は書き換えない */
export async function readRules(): Promise<ParsedRules> {
  return parseRules(await rulesItem.getValue());
}

/** ルールの一覧を保存する */
export async function writeRules(rules: readonly Rule[]): Promise<void> {
  await rulesItem.setValue([...rules]);
}

/** 保存されたルールの一覧の変更を、壊れた箇所を直して通知する。購読を解除する関数を返す */
export function watchRules(listener: (rules: ParsedRules) => void): () => void {
  return rulesItem.watch((newValue) => listener(parseRules(newValue)));
}

/** watchRules と同じく変更を通知する。変更前の一覧も直して渡す */
export function watchRuleChanges(listener: (newRules: ParsedRules, oldRules: ParsedRules) => void): () => void {
  return rulesItem.watch((newValue, oldValue) => listener(parseRules(newValue), parseRules(oldValue)));
}
