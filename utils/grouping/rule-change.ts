import { validRules } from "../rules/match";
import type { GroupColor, Rule } from "../rules/types";
import type { GroupOperation, WindowSnapshot } from "./types";

/** 名前・色が変わったルール。oldName のグループを name・color に変える */
export interface RuleUpdate {
  oldName: string;
  name: string;
  color: GroupColor;
}

export interface RuleChange {
  updates: RuleUpdate[];
  /** 変更前は有効で、変更後は有効なルールの名前でなくなった名前（削除・無効化・名前の変更） */
  retiredNames: string[];
}

/** ルールの一覧の変更前後を id で突き合わせ、既存のグループへ反映する差分を求める。無効なルールは比べない */
export function diffRules(oldRules: readonly Rule[], newRules: readonly Rule[]): RuleChange {
  const oldActive = validRules(oldRules);
  const newActive = validRules(newRules);
  const newById = new Map(newActive.map((rule) => [rule.id, rule]));
  const newNames = new Set(newActive.map((rule) => rule.name));

  const updates: RuleUpdate[] = [];
  for (const oldRule of oldActive) {
    const newRule = newById.get(oldRule.id);
    if (newRule !== undefined && (newRule.name !== oldRule.name || newRule.color !== oldRule.color)) {
      updates.push({ oldName: oldRule.name, name: newRule.name, color: newRule.color });
    }
  }
  const retiredNames = oldActive.map((rule) => rule.name).filter((name) => !newNames.has(name));
  return { updates, retiredNames };
}

/**
 * 名前・色が変わったルールの既存のグループのタイトル・色を変える操作の計画を組み立てる。
 * 旧い名前のグループが複数あれば、すべてを変える。すでに新しいタイトル・色のグループには操作を出さない
 */
export function planGroupUpdates(window: WindowSnapshot, updates: readonly RuleUpdate[]): GroupOperation[] {
  const updateByOldName = new Map(updates.map((update) => [update.oldName, update]));
  return window.groups.flatMap((group): GroupOperation[] => {
    const update = updateByOldName.get(group.title);
    if (update === undefined || (update.name === group.title && update.color === group.color)) {
      return [];
    }
    return [{ type: "update-group", groupId: group.id, title: update.name, color: update.color }];
  });
}
