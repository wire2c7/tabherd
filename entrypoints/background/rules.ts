import type { Browser } from "wxt/browser";

import type { RulesState } from "../../utils/grouping/regroup";
import { getAppLogger } from "../../utils/logging/setup";
import { DAMAGE_WARNED_ITEM, createRulesReader } from "../../utils/rules/reader";
import { createSampleRules } from "../../utils/rules/seed";
import { RULES_ITEM, RULE_TITLES_ITEM, createRuleTitlesStore, createRulesStore } from "../../utils/rules/storage";
import { defineStorageItem } from "../platform/storage";

const logger = getAppLogger("background");

/** 保存されたルールの一覧の読み書き */
export const rulesStore = createRulesStore(defineStorageItem(RULES_ITEM));

/** 保存されたルールの一覧の読み込みと購読。壊れていれば警告のログを残す */
export const rulesReader = createRulesReader(rulesStore, defineStorageItem(DAMAGE_WARNED_ITEM), logger);

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

/**
 * 初回インストール時にだけ、サンプルルールを投入する。
 *
 * @param reason - browser.runtime.onInstalled のイベントが渡す、拡張機能が変わった理由
 * @remarks アップデート時や、既にルールが1件以上保存されているときは何もしない
 */
export async function seedSampleRulesOnFirstInstall(reason: Browser.runtime.InstalledDetails["reason"]): Promise<void> {
  if (reason !== "install") {
    return;
  }
  const rules = await rulesReader.read();
  if (rules.length > 0) {
    return;
  }
  logger.info("サンプルルールを投入します");
  await rulesStore.write(createSampleRules());
}
