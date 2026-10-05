import { validRules } from "../rules/match";
import type { GroupColor, Rule, RuleTitles } from "../rules/types";
import { NO_TITLES } from "../rules/types";
import type { GroupOperation, WindowSnapshot } from "./types";

/** 名前・色が変わったルール。oldName のグループを name・color に変える */
export interface RuleUpdate {
  oldName: string;
  name: string;
  color: GroupColor;
}

export interface RuleChange {
  updates: RuleUpdate[];
  /** 変更前にルールが持っていて、変更後はどのルールも持たなくなったタイトル（削除・名前の変更） */
  retiredNames: string[];
  /** 変更後にルールが持っているタイトル */
  titles: Map<string, string>;
}

/**
 * ルールの一覧の変更前後と、変更前にルールが持っていたタイトル（titles）から、既存のグループへ反映する差分を求める。
 * titles に無いルールは、変更前に有効ならその名前を持っていたものとみなす（記録より前に作ったルール）。
 * 有効なルールは名前をタイトルとして持ち、持っていたタイトルと名前が違うか、変更前に無効だったか、色が変わったら、そのグループを変える。
 * 無効なルールは、有効なルールの名前と重ならない限り、持っていたタイトルを持ち続ける
 */
export function diffRules(
  oldRules: readonly Rule[],
  newRules: readonly Rule[],
  titles: RuleTitles = NO_TITLES,
): RuleChange {
  const oldById = new Map(validRules(oldRules, titles).map((rule) => [rule.id, rule]));
  function previousTitle(id: string): string | undefined {
    return titles.get(id) ?? oldById.get(id)?.name;
  }
  const newActive = validRules(newRules, titles);
  const newTitles = new Map<string, string>();
  const updates: RuleUpdate[] = [];
  for (const rule of newActive) {
    newTitles.set(rule.id, rule.name);
    const previous = previousTitle(rule.id);
    const oldRule = oldById.get(rule.id);
    if (previous !== undefined && (previous !== rule.name || oldRule?.color !== rule.color)) {
      updates.push({ oldName: previous, name: rule.name, color: rule.color });
    }
  }
  const newNames = new Set(newActive.map((rule) => rule.name));
  for (const rule of newRules) {
    const previous = previousTitle(rule.id);
    if (!newTitles.has(rule.id) && previous !== undefined && !newNames.has(previous)) {
      newTitles.set(rule.id, previous);
    }
  }
  const keptTitles = new Set(newTitles.values());
  const oldTitles = new Set([...titles.values(), ...[...oldById.values()].map((rule) => rule.name)]);
  const retiredNames = [...oldTitles].filter((title) => !keptTitles.has(title));
  return { updates, retiredNames, titles: newTitles };
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
