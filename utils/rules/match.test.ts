import { describe, expect, it } from "vitest";

import {
  countUnusedRules,
  findMatchingRule,
  findRuleProblems,
  groupTitlesInOrder,
  heldTitles,
  isValidRegex,
  matchesCondition,
  validRules,
} from "./match";
import type { Condition, Rule } from "./types";

function rule(name: string, conditions: Condition[]): Rule {
  return { id: name, name, color: "blue", conditions };
}

function contains(value: string): Condition {
  return { type: "contains", value };
}

function regex(value: string): Condition {
  return { type: "regex", value };
}

describe("部分一致の条件", () => {
  it("値が URL に含まれるとき一致する", () => {
    // 前提: 条件の値 github.com が URL に含まれる
    // 検証: true を返す
    expect(matchesCondition("https://github.com/wire2c7/tabherd", contains("github.com"))).toBe(true);
  });

  it("値が URL に含まれないとき一致しない", () => {
    // 前提: 条件の値 github.com が URL に含まれない
    // 検証: false を返す
    expect(matchesCondition("https://gitlab.com/", contains("github.com"))).toBe(false);
  });

  it("大文字・小文字を区別しない", () => {
    // 前提: URL・条件の値のどちらかの大文字・小文字が異なる組み合わせ
    // 検証: どちらの組み合わせでも true を返す
    expect(matchesCondition("https://github.com/", contains("GitHub.com"))).toBe(true);
    expect(matchesCondition("https://GITHUB.com/", contains("github.com"))).toBe(true);
  });

  it("値が空のときどの URL にも一致しない", () => {
    // 前提: 条件の値が空文字列
    // 検証: false を返す
    expect(matchesCondition("https://github.com/", contains(""))).toBe(false);
  });
});

describe("正規表現の条件", () => {
  it("パターンが URL のどこかに見つかれば一致する", () => {
    // 前提: パターンに一致する部分を含む URL
    // 検証: true を返す
    expect(matchesCondition("https://docs.example.com/guide", regex(String.raw`^https://[^/]+\.example\.com/`))).toBe(
      true,
    );
  });

  it("一致しない URL には一致しない", () => {
    // 前提: パターンに一致する部分を含まない URL
    // 検証: false を返す
    expect(matchesCondition("https://example.org/", regex(String.raw`^https://[^/]+\.example\.com/`))).toBe(false);
  });

  it("大文字・小文字を区別する", () => {
    // 前提: URL 中の文字列の大文字・小文字がパターンと異なる
    // 検証: false を返す
    expect(matchesCondition("https://GitHub.com/", regex("github"))).toBe(false);
  });

  it("構文が不正な値は例外を出さずに一致しない", () => {
    // 前提: 構文が不正な正規表現（"("）
    // 検証: 例外を投げず、false を返す
    expect(() => matchesCondition("https://example.com/", regex("("))).not.toThrow();
    expect(matchesCondition("https://example.com/", regex("("))).toBe(false);
  });

  it("値が空のときどの URL にも一致しない", () => {
    // 前提: 条件の値が空文字列
    // 検証: false を返す
    expect(matchesCondition("https://example.com/", regex(""))).toBe(false);
  });
});

describe("正規表現の構文の検証", () => {
  it("構文が正しい正規表現は有効", () => {
    // 前提: 構文が正しい正規表現
    // 検証: true を返す
    expect(isValidRegex(String.raw`^https://example\.com/`)).toBe(true);
  });

  it("構文が不正な正規表現は無効", () => {
    // 前提: 構文が不正な正規表現（閉じていない括弧・文字クラス）
    // 検証: いずれも false を返す
    expect(isValidRegex("(")).toBe(false);
    expect(isValidRegex("[a-")).toBe(false);
  });

  it("空文字列は無効", () => {
    // 前提: 値が空文字列
    // 検証: false を返す
    expect(isValidRegex("")).toBe(false);
  });
});

describe("ルールの無効になる理由", () => {
  it("有効なルールは null になる", () => {
    // 前提: 名前が重複せず空でもない2件のルール
    // 検証: どちらも null（問題なし）になる
    expect(findRuleProblems([rule("開発", []), rule("資料", [])])).toStrictEqual([null, null]);
  });

  it("空のグループ名は empty-name になる（前後の空白を除いて判定する）", () => {
    // 前提: 名前が空文字列のルールと、前後が空白だけのルール
    // 検証: どちらも empty-name になる
    expect(findRuleProblems([rule("", []), rule("  ", [])])).toStrictEqual(["empty-name", "empty-name"]);
  });

  it("上のルールと同じグループ名は duplicate-name になる", () => {
    // 前提: 1番目と3番目のルールが同じ名前（開発）
    // 検証: 1番目は null、3番目（後から同じ名前にした方）が duplicate-name になる
    expect(findRuleProblems([rule("開発", []), rule("資料", []), rule("開発", [])])).toStrictEqual([
      null,
      null,
      "duplicate-name",
    ]);
  });
});

describe("タイトルを持っているルールの優先", () => {
  const upper: Rule = { id: "upper", name: "業務", color: "blue", conditions: [] };
  const lower: Rule = { id: "lower", name: "業務", color: "red", conditions: [] };

  it("下のルールがその名前のタイトルを持っていれば、後から同じ名前にした上のルールが duplicate-name になる", () => {
    // 前提: upper・lower が共に名前「業務」、lower がタイトル「業務」を持ち続けている
    // 検証: upper が duplicate-name、lower は null になる
    expect(findRuleProblems([upper, lower], new Map([["lower", "業務"]]))).toStrictEqual(["duplicate-name", null]);
  });

  it("名前を空にしたルールが持ち続けるタイトルと同じ名前のルールは duplicate-name になる", () => {
    // 前提: emptied は名前が空だがタイトル「業務」を持ち続け、lower の名前も「業務」
    // 検証: emptied が empty-name、lower が duplicate-name になる
    const emptied: Rule = { id: "emptied", name: "", color: "blue", conditions: [] };
    expect(findRuleProblems([emptied, lower], new Map([["emptied", "業務"]]))).toStrictEqual([
      "empty-name",
      "duplicate-name",
    ]);
  });

  it("一覧に無いルールのタイトルは数えない", () => {
    // 前提: タイトルの Map に、ルール一覧に無い id（deleted）のエントリがある
    // 検証: upper は null（問題なし）のままになる
    expect(findRuleProblems([upper], new Map([["deleted", "業務"]]))).toStrictEqual([null]);
  });
});

describe("名前の入れ替え", () => {
  it("互いに相手の持っているタイトルを名前にしたルールは、どちらも有効になる", () => {
    // 前提: dev の名前が docs の持つタイトル、docs の名前が dev の持つタイトルと入れ替わっている
    // 検証: どちらも null（問題なし）になる
    const dev: Rule = { id: "dev", name: "資料", color: "blue", conditions: [] };
    const docs: Rule = { id: "docs", name: "開発", color: "green", conditions: [] };
    const titles = new Map([
      ["dev", "開発"],
      ["docs", "資料"],
    ]);
    expect(findRuleProblems([dev, docs], titles)).toStrictEqual([null, null]);
  });

  it("相手が自分の名前のタイトルを持ったままなら、入れ替えではなく後から同じ名前にした方が無効になる", () => {
    // 前提: dev・docs の名前が共に「資料」だが、docs だけがタイトル「資料」を持ち続けている（入れ替えではない）
    // 検証: dev が duplicate-name、docs は null になる
    const dev: Rule = { id: "dev", name: "資料", color: "blue", conditions: [] };
    const docs: Rule = { id: "docs", name: "資料", color: "green", conditions: [] };
    const titles = new Map([
      ["dev", "開発"],
      ["docs", "資料"],
    ]);
    expect(findRuleProblems([dev, docs], titles)).toStrictEqual(["duplicate-name", null]);
  });
});

describe("無効なルールが持ち続けるタイトル", () => {
  const dev: Rule = { id: "dev", name: "", color: "blue", conditions: [] };
  const docs: Rule = { id: "docs", name: "資料", color: "green", conditions: [] };
  const titles = new Map([
    ["dev", "開発"],
    ["docs", "資料"],
  ]);

  it("無効なルールのタイトルだけを返す", () => {
    // 前提: dev（名前が空で無効）・docs（名前「資料」で有効）がそれぞれタイトルを持ち続けている
    // 検証: 無効な dev のタイトルだけが残る
    expect(heldTitles([dev, docs], titles)).toStrictEqual(new Map([["dev", "開発"]]));
  });

  it("並べるタイトルは、無効なルールの持ち続けるタイトルをルールの位置に含める", () => {
    // 前提: titles を渡す（無効な dev の持ち続けるタイトルも含む）
    // 検証: dev の位置のタイトル「開発」と docs の名前「資料」が、ルールの順に並ぶ
    expect(groupTitlesInOrder([dev, docs], titles)).toStrictEqual(["開発", "資料"]);
  });

  it("タイトルを持っていない無効なルールは並べるタイトルに含めない", () => {
    // 前提: titles を渡さない（無効な dev のタイトルが無い）
    // 検証: 有効な docs の名前「資料」だけが残る
    expect(groupTitlesInOrder([dev, docs])).toStrictEqual(["資料"]);
  });
});

describe("使われないルールの件数", () => {
  it("重複したグループ名のルールと、グループのタイトルを持っていて名前が空のルールを数える", () => {
    // 前提: 名前が重複するルール（開発が2件）と、名前が空だがタイトルを持ち続けるルール（emptied）が混在する
    // 検証: 重複1件・空名1件の合計2を返す
    const emptied: Rule = { id: "emptied", name: "", color: "blue", conditions: [] };
    const rules = [rule("開発", []), emptied, rule("資料", []), { ...rule("開発", []), id: "dup" }];
    expect(countUnusedRules(rules, new Map([["emptied", "業務"]]))).toBe(2);
  });

  it("名前が空でもグループのタイトルを持っていない（追加したばかりの）ルールは数えない", () => {
    // 前提: 名前が空のルールがあるが、titles にそのタイトルが無い（追加したばかりの想定）
    // 検証: 0 を返す
    expect(countUnusedRules([rule("開発", []), rule("", [])], new Map())).toBe(0);
  });

  it("すべて有効なら 0", () => {
    // 前提: 名前が重複せず空でもないルールのみ
    // 検証: 0 を返す
    expect(countUnusedRules([rule("開発", []), rule("資料", [])], new Map())).toBe(0);
  });
});

describe("有効なルールの抽出", () => {
  it("無効なルールを除き、一覧の順を保つ", () => {
    // 前提: 名前が空のルールと、名前が重複するルール（開発が2件）が混在する
    // 検証: 無効な2件を除いた「開発」「資料」が、元の順のまま残る
    const rules = [rule("開発", []), rule("", []), rule("資料", []), rule("開発", [])];
    expect(validRules(rules).map((r) => r.name)).toStrictEqual(["開発", "資料"]);
  });
});

describe("一致するルールの決定", () => {
  it("条件のいずれか1つに一致すれば一致する", () => {
    // 前提: 2つの条件のうち2番目（gitlab.com）だけが URL に一致する
    // 検証: そのルール（開発）を返す
    const rules = [rule("開発", [contains("github.com"), contains("gitlab.com")])];
    expect(findMatchingRule("https://gitlab.com/", rules)?.name).toBe("開発");
  });

  it("複数のルールに一致するとき一覧で上のルールを選ぶ", () => {
    // 前提: URL が2つのルール双方の条件に一致する
    // 検証: 一覧で上（業務）を返す
    const rules = [rule("業務", [contains("github.com/wire2c7")]), rule("開発", [contains("github.com")])];
    expect(findMatchingRule("https://github.com/wire2c7/tabherd", rules)?.name).toBe("業務");
  });

  it("どのルールにも一致しないとき null を返す", () => {
    // 前提: URL がどのルールの条件にも一致しない
    // 検証: null を返す
    const rules = [rule("開発", [contains("github.com")])];
    expect(findMatchingRule("https://example.com/", rules)).toBeNull();
  });

  it("グループ名が空のルールは判定の対象にしない", () => {
    // 前提: 条件には一致するが、ルールの名前が空
    // 検証: null を返す
    const rules = [rule("", [contains("github.com")])];
    expect(findMatchingRule("https://github.com/", rules)).toBeNull();
  });

  it("グループ名が上のルールと重複するルールは判定の対象にしない", () => {
    // 前提: URL に一致するルール（dup）が、名前が上のルールと重複する（開発）
    // 検証: 重複するルールは対象外のため null を返す
    const rules = [
      rule("開発", [contains("gitlab.com")]),
      rule("資料", [contains("example.com")]),
      { ...rule("開発", [contains("github.com")]), id: "dup" },
    ];
    expect(findMatchingRule("https://github.com/", rules)).toBeNull();
  });

  it("構文が不正な正規表現があってもほかの条件の判定を続ける", () => {
    // 前提: 条件の1つ目が構文の不正な正規表現、2つ目が一致する部分一致条件
    // 検証: 例外を投げず、2つ目の条件で一致してそのルール（開発）を返す
    const rules = [rule("開発", [regex("("), contains("github.com")])];
    expect(findMatchingRule("https://github.com/", rules)?.name).toBe("開発");
  });
});
