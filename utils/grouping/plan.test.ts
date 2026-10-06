import { describe, expect, it } from "vitest";

import type { Rule } from "../rules/types";
import { TAB_GROUP_ID_NONE, planGrouping } from "./plan";
import type { GroupSnapshot, TabSnapshot, WindowSnapshot } from "./types";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github.com" }] };
const DOCS: Rule = {
  id: "docs",
  name: "資料",
  color: "green",
  conditions: [{ type: "contains", value: "example.com" }],
};
const RULES = [DEV, DOCS];

function tab(id: number, url: string, groupId = TAB_GROUP_ID_NONE): TabSnapshot {
  return { id, url, pinned: false, groupId };
}

function group(id: number, title: string): GroupSnapshot {
  return { id, title, color: "grey" };
}

function windowOf(tabs: TabSnapshot[], groups: GroupSnapshot[] = [], id = 1): WindowSnapshot {
  return { id, tabs, groups };
}

describe("タブの判定とグループ化", () => {
  it("一致したルールのグループがなければ、ルールの名前・色で作って入れる", () => {
    // 前提/検証: github.com に一致するタブだけで一致するグループが無いと、「開発」の名前・色でグループを作って入れる
    const window = windowOf([tab(10, "https://github.com/")]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10] },
    ]);
  });

  it("同じウィンドウに一致したルールのグループがあれば、そこへ入れる", () => {
    // 前提/検証: 「開発」(100)がすでにあり未所属のタブ(11)が一致すると、そのタブだけを既存のグループへ入れる
    const tabs = [tab(10, "https://github.com/a", 100), tab(11, "https://github.com/b")];
    const window = windowOf(tabs, [group(100, "開発")]);
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 100, tabIds: [11] }]);
  });

  it("すでにそのグループに入っているタブには操作を出さない", () => {
    // 前提/検証: 一致するタブがすでに一致するグループ「開発」(100)に入っていれば、操作は出ない
    const window = windowOf([tab(10, "https://github.com/", 100)], [group(100, "開発")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });

  it("同じルールに一致する複数のタブは、1つのグループを作ってまとめる", () => {
    // 前提/検証: github.com(2枚)・example.com(1枚)に一致しどちらのグループも無いと、作って該当タブをまとめる2操作が出る
    const window = windowOf([
      tab(10, "https://github.com/a"),
      tab(11, "https://example.com/"),
      tab(12, "https://github.com/b"),
    ]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10, 12] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("判定するタブを指定すると、そのタブだけに操作を出す", () => {
    // 前提/検証: 一致するタブが2枚あっても targetTabIds で11だけを指定すると、11だけを入れる操作が出る
    const window = windowOf([tab(10, "https://github.com/a"), tab(11, "https://github.com/b")]);
    expect(planGrouping(window, RULES, { targetTabIds: new Set([11]) })).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [11] },
    ]);
  });

  it("どのルールにも一致せず、グループにも入っていないタブには操作を出さない", () => {
    // 前提/検証: どのルールにも一致せずグループにも入っていないタブには、操作が出ない
    const window = windowOf([tab(10, "https://example.org/")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("管理対象のグループ", () => {
  it("ルールのグループ名と異なるタイトルのグループのタブは移動しない", () => {
    // 前提: github.com に一致するタブが、ルール名と違う「手動」という名前のグループに入っている
    // 検証: 操作が出ない（管理対象でないグループとして扱われる）
    const window = windowOf([tab(10, "https://github.com/", 100)], [group(100, "手動")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });

  it("タイトルが空のグループは管理対象にしない（グループ名が空のルールは無効）", () => {
    // 前提: ルールの名前が空（無効）で、タブはタイトルが空のグループに入っている
    // 検証: 操作が出ない（空配列）
    const rules: Rule[] = [{ ...DEV, name: "" }];
    const window = windowOf([tab(10, "https://example.org/", 100)], [group(100, "")]);
    expect(planGrouping(window, rules)).toStrictEqual([]);
  });

  it("別のウィンドウのグループは使わず、ウィンドウごとにグループを作る", () => {
    // 前提: ウィンドウ A（id: 1）の「開発」のグループは、ウィンドウ B（id: 2）のスナップショットに含まれない
    // 検証: ウィンドウ B 用に、ウィンドウ A のグループを使い回さず新しくグループを作る操作が出る
    const windowB = windowOf([tab(20, "https://github.com/")], [], 2);
    expect(planGrouping(windowB, RULES)).toStrictEqual([
      { type: "create-group", windowId: 2, title: "開発", color: "blue", tabIds: [20] },
    ]);
  });

  it("同名のグループが複数あるときは、タブバーで左にあるものへ入れる", () => {
    // 前提: 同名「開発」のグループが2つ(200, 100、左から 200→100 の順)あり、未所属のタブが1枚ある
    // 検証: タブバーで左にあるグループ(200)へ未所属タブを入れる1操作が出る
    const window = windowOf(
      [tab(10, "https://github.com/a", 200), tab(11, "https://github.com/b", 100), tab(12, "https://github.com/c")],
      [group(100, "開発"), group(200, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 200, tabIds: [12] }]);
  });
});

describe("一致しなくなったタブ", () => {
  it("別のルールに一致する URL へ移動したタブは、そのルールのグループへ移す", () => {
    // 前提: 「開発」グループ(100)のタブの URL が example.com（「資料」ルールに一致）へ変わっており、「資料」グループ(200)も存在する
    // 検証: そのタブを「資料」グループ(200)へ入れる1操作が出る
    const window = windowOf(
      [tab(10, "https://example.com/", 100), tab(11, "https://example.com/docs", 200)],
      [group(100, "開発"), group(200, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 200, tabIds: [10] }]);
  });

  it("別のルールのグループがなければ作って移す", () => {
    // 前提: 「開発」グループ(100)のタブの URL が example.com（「資料」ルールに一致）へ変わっており、「資料」グループが無い
    // 検証: 「資料」グループを新しく作ってそのタブを入れる1操作が出る
    const window = windowOf([tab(10, "https://example.com/", 100)], [group(100, "開発")]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [10] },
    ]);
  });

  it("どのルールにも一致しない URL へ移動したタブは、グループから外す", () => {
    // 前提: 「開発」グループ(100)の2枚のタブの URL が example.org（どのルールにも一致しない）へ変わっている
    // 検証: その2枚を ungroup する1操作が出る
    const window = windowOf(
      [tab(10, "https://example.org/", 100), tab(11, "https://example.org/b", 100)],
      [group(100, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "ungroup", tabIds: [10, 11] }]);
  });

  it("手動で作ったグループのタブは、どのルールにも一致しなくても外さない", () => {
    // 前提: どのルール名とも一致しない「手動」グループ(100)に、どのルールにも一致しない URL のタブが入っている
    // 検証: 操作が出ない（管理対象でないグループなので外さない）
    const window = windowOf([tab(10, "https://example.org/", 100)], [group(100, "手動")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("対象外のタブ", () => {
  it("ピン留めされたタブはグループに入れない", () => {
    // 前提: github.com に一致する URL のタブがピン留めされている
    // 検証: 操作が出ない（空配列）
    const window = windowOf([{ ...tab(10, "https://github.com/"), pinned: true }]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("同じ判定で空になるグループ", () => {
  it("元のタブがすべて外れるグループには入れず、新しく作って入れる", () => {
    // 前提/検証: 元タブ(10)が一致しなくなり別タブ(11)が「資料」に一致すると、ungroup と新規作成の2操作が出る（再利用しない）
    const window = windowOf(
      [tab(10, "https://other.test/", 100), tab(11, "https://example.com/")],
      [group(100, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "ungroup", tabIds: [10] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("元のタブがすべて別のグループへ移るグループには入れず、新しく作って入れる", () => {
    // 前提/検証: 元タブ(10)が「開発」に変わり別タブ(11)が「資料」に一致すると、既存へ移す操作と新規作成の2操作が出る
    const window = windowOf(
      [tab(10, "https://github.com/a", 100), tab(11, "https://example.com/"), tab(12, "https://github.com/b", 101)],
      [group(100, "資料"), group(101, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "add-to-group", groupId: 101, tabIds: [10] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("2つのグループの中身が入れ替わるときは、どちらにも入れず、それぞれ新しく作って入れる", () => {
    // 前提/検証: 「開発」(100)と「資料」(101)の中身が入れ替わると、どちらも再利用せずそれぞれ新しく作る2操作が出る
    const window = windowOf(
      [tab(10, "https://example.com/", 100), tab(11, "https://github.com/", 101)],
      [group(100, "開発"), group(101, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [10] },
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [11] },
    ]);
  });

  it("同名のグループのうち左のものが空になるときは、残る右のものへ入れる", () => {
    // 前提/検証: 同名「資料」(100,101)の左(100)が一致しなくなり新タブが一致すると、外す操作と右(101)へ入れる操作が出る
    const window = windowOf(
      [tab(10, "https://other.test/", 100), tab(11, "https://example.com/a", 101), tab(12, "https://example.com/b")],
      [group(100, "資料"), group(101, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "ungroup", tabIds: [10] },
      { type: "add-to-group", groupId: 101, tabIds: [12] },
    ]);
  });
});

describe("無効なルールが持ち続けるタイトルのグループ", () => {
  it("中のタブは動かさず、条件に一致する新しいタブも入れない", () => {
    // 前提: 「開発」ルールの名前を空にして無効化（持ち続けたタイトル「開発」を titles で渡す）し、
    //       グループ(100)内に一致しないタブ(10)、グループ外に条件に一致する新しいタブ(11)がある
    // 検証: 操作が出ない（中のタブも動かさず、新しいタブも入れない）
    const emptied: Rule = { ...DEV, name: "" };
    const window = windowOf(
      [tab(10, "https://example.org/", 100), tab(11, "https://github.com/new")],
      [group(100, "開発")],
    );
    expect(planGrouping(window, [emptied, DOCS], { titles: new Map([[DEV.id, "開発"]]) })).toStrictEqual([]);
  });

  it("後から同じ名前にしたルールではなく、タイトルを持っているルールでまとめる", () => {
    // 前提: DEV ルールの名前を「資料」に変えており、DOCS がもともと「資料」のタイトルを記録 (titles) で持つ
    // 検証: タイトルを記録上持つ DOCS ルールの判定に一致したタブだけが「資料」グループを作って入り、名前を変えた DEV 側の一致では作らない
    const renamed: Rule = { ...DEV, name: "資料" };
    const titles = new Map([
      [DEV.id, "開発"],
      [DOCS.id, "資料"],
    ]);
    const window = windowOf([tab(10, "https://github.com/"), tab(11, "https://example.com/")]);
    expect(planGrouping(window, [renamed, DOCS], { titles })).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });
});
