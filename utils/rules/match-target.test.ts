import { describe, expect, it } from "vitest";

import { findMatchingRule, matchesCondition } from "./match";
import type { MatchTarget } from "./match";
import type { Condition, ConditionTarget, Rule } from "./types";

function rule(name: string, conditions: Condition[]): Rule {
  return { id: name, name, color: "blue", conditions };
}

function contains(value: string, target: ConditionTarget): Condition {
  return { target, type: "contains", value };
}

function regex(value: string, target: ConditionTarget): Condition {
  return { target, type: "regex", value };
}

/** タイトルを持った MatchTarget を作る（url は適当な値） */
function withTitle(title: string): MatchTarget {
  return { url: "https://example.com/", title };
}

describe("タイトルを対象にした条件", () => {
  it("部分一致はタイトルに対して判定する", () => {
    // 前提: タイトルを対象にした部分一致 Pull Request が、タイトルに含まれる
    // 検証: true を返す
    expect(
      matchesCondition(
        withTitle("Add title condition by wire2c7 · Pull Request #99"),
        contains("Pull Request", "title"),
      ),
    ).toBe(true);
  });

  it("url には判定しない", () => {
    // 前提: タイトルを対象にした条件の値が URL には含まれるが、タイトルには含まれない
    // 検証: false を返す
    expect(
      matchesCondition({ url: "https://github.com/", title: "トップページ" }, contains("github.com", "title")),
    ).toBe(false);
  });

  it("タイトルが未確定（空文字列）のときは一致しない", () => {
    // 前提: タイトルが空文字列で、値が空でない条件
    // 検証: false を返す
    expect(matchesCondition(withTitle(""), contains("読み込み中", "title"))).toBe(false);
  });

  it("正規表現はタイトルに対して判定する", () => {
    // 前提: タイトルを対象にした正規表現 ^\[.+\] が、タイトルの先頭に一致する
    // 検証: true を返す
    expect(matchesCondition(withTitle("[開発] チケット一覧"), regex(String.raw`^\[.+\] `, "title"))).toBe(true);
  });

  it("url とタイトルの条件を組み合わせたルールに一致する", () => {
    // 前提: ルール「開発」が URL を対象にした条件とタイトルを対象にした条件を持ち、両方に一致するタブを判定する
    const rules = [rule("開発", [contains("github.com", "url"), contains("Pull Request", "title")])];
    const target: MatchTarget = {
      url: "https://github.com/wire2c7/tabherd/pull/99",
      title: "Add title condition by wire2c7 · Pull Request #99",
    };
    // 検証: そのルール（開発）を返す
    expect(findMatchingRule(target, rules)?.name).toBe("開発");
  });
});
