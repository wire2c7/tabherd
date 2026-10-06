import type { RulesState } from "../../utils/grouping/regroup";
import { getAppLogger } from "../../utils/logging/setup";
import { DAMAGE_WARNED_ITEM, createRulesReader } from "../../utils/rules/reader";
import { RULES_ITEM, RULE_TITLES_ITEM, createRuleTitlesStore, createRulesStore } from "../../utils/rules/storage";
import { defineStorageItem } from "../platform/storage";

/** 保存されたルールの一覧の読み込みと購読。壊れていれば警告のログを残す */
export const rulesReader = createRulesReader(
  createRulesStore(defineStorageItem(RULES_ITEM)),
  defineStorageItem(DAMAGE_WARNED_ITEM),
  getAppLogger("background"),
);

/** ルールが持っているグループのタイトル。反映するたびに書き直す */
export const titlesStore = createRuleTitlesStore(defineStorageItem(RULE_TITLES_ITEM));

/**
 * 保存されたルールの一覧と、ルールが持っているグループのタイトルを読む。
 *
 * @returns ルールの一覧とグループのタイトル
 */
export async function readRulesState(): Promise<RulesState> {
  const [rules, titles] = await Promise.all([rulesReader.read(), titlesStore.read()]);
  return { rules, titles };
}
