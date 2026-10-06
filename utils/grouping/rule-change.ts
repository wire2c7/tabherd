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
 * basis の記録で有効性を決めたときの、有効なルールと、変更後にルールが持つタイトルを求める。
 * 有効なルールは名前を、無効なルールは previousTitle を、有効なルールの名前と重ならない限り持ち続ける。
 * heldTitles（utils/rules/match.ts）と違い、記録に無いルールも変更前の名前を持っていたものとみなす（記録より前に作ったルール）
 */
function nextTitles(
  newRules: readonly Rule[],
  basis: RuleTitles,
  previousTitle: (id: string) => string | undefined,
): { active: Rule[]; titles: Map<string, string> } {
  const active = validRules(newRules, basis);
  const titles = new Map(active.map((rule) => [rule.id, rule.name]));
  const activeNames = new Set(active.map((rule) => rule.name));
  for (const rule of newRules) {
    const previous = previousTitle(rule.id);
    if (!titles.has(rule.id) && previous !== undefined && !activeNames.has(previous)) {
      titles.set(rule.id, previous);
    }
  }
  return { active, titles };
}

function isSameTitles(a: RuleTitles, b: RuleTitles): boolean {
  return a.size === b.size && [...a].every(([id, title]) => b.get(id) === title);
}

/**
 * ルールの一覧の変更前後と、変更前にルールが持っていたタイトル（titles）から、既存のグループへ反映する差分を求める。
 *
 * @param oldRules - 変更前のルールの一覧
 * @param newRules - 変更後のルールの一覧
 * @param titles - 変更前にルールが持っていたタイトル
 * @returns 既存のグループへ反映するタイトル・色の変更、使われなくなったタイトル、変更後にルールが持つタイトル
 * @remarks titles に無いルールは、変更前に有効ならその名前を持っていたものとみなす（記録より前に作ったルール）。
 * 有効なルールは名前をタイトルとして持ち、持っていたタイトルと名前が違うか、変更前に無効だったか、色が変わったら、そのグループを変える。
 * 持ち主が削除・改名したタイトルを引き継いだルールも、そのグループの色を変える。
 * 無効なルールは、有効なルールの名前と重ならない限り、持っていたタイトルを持ち続ける。
 * 有効性は記録で決まり、記録は有効性で決まるため、記録が変わらなくなるまで求め直す（タイトルを手放したルールの後に、同じ名前のルールが有効になる）
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
  let next = nextTitles(newRules, titles, previousTitle);
  // 前の回に有効だったルールは自分の名前のタイトルを持つため次の回も有効で、有効なルールは増えるか止まる。
  // 増えるのはタイトルを手放すルールが有効なときだけのため、増える回数はルールの数より少なく、ルールの数だけ求め直せば止まる
  // （rule-change.property.test.ts で確かめている）。回数で打ち切るのは念のため
  let rounds = 0;
  let changed = true;
  while (changed && rounds < newRules.length) {
    const again = nextTitles(newRules, next.titles, previousTitle);
    changed = !isSameTitles(again.titles, next.titles);
    next = again;
    rounds += 1;
  }
  const oldTitles = new Set([...titles.values(), ...[...oldById.values()].map((rule) => rule.name)]);
  const updates = planTitleUpdates(next.active, oldById, { previousTitle, oldTitles });
  const keptTitles = new Set(next.titles.values());
  const retiredNames = [...oldTitles].filter((title) => !keptTitles.has(title));
  return { updates, retiredNames, titles: next.titles };
}

/** 有効なルールのグループのタイトル・色の変更。持っていたタイトルの変更を先に決め、変更されないタイトルを引き継いだルールは色だけを変える */
function planTitleUpdates(
  active: readonly Rule[],
  oldById: ReadonlyMap<string, Rule>,
  { previousTitle, oldTitles }: { previousTitle: (id: string) => string | undefined; oldTitles: ReadonlySet<string> },
): RuleUpdate[] {
  const updates: RuleUpdate[] = [];
  const takeovers: Rule[] = [];
  for (const rule of active) {
    const previous = previousTitle(rule.id);
    if (previous === undefined) {
      if (oldTitles.has(rule.name)) {
        takeovers.push(rule);
      }
    } else if (previous !== rule.name || oldById.get(rule.id)?.color !== rule.color) {
      updates.push({ oldName: previous, name: rule.name, color: rule.color });
    }
  }
  // 持ち主が改名するタイトルは、改名の後には残らないため引き継がない
  const renamedFrom = new Set(updates.map((update) => update.oldName));
  for (const rule of takeovers.filter((candidate) => !renamedFrom.has(candidate.name))) {
    updates.push({ oldName: rule.name, name: rule.name, color: rule.color });
  }
  return updates;
}

/**
 * 名前・色が変わったルールの既存のグループのタイトル・色を変える操作の計画を組み立てる。
 *
 * @param window - 対象のウィンドウのスナップショット
 * @param updates - 反映する名前・色の変更
 * @returns グループのタイトル・色を変える操作の一覧
 * @remarks 旧い名前のグループが複数あれば、すべてを変える。すでに新しいタイトル・色のグループには操作を出さない
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
