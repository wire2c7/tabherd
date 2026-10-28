import { pickNewRuleColor } from "./color";
import type { Condition, Rule } from "./types";

function urlContains(value: string): Condition {
  return { target: "url", type: "contains", value };
}

function titleContains(value: string): Condition {
  return { target: "title", type: "contains", value };
}

/**
 * 初回インストール時に投入するサンプルルールを作る。
 *
 * @returns `⚙設定`・`📺️動画`・`📃ブログ` の3件のルール。色は GROUP_COLORS（grey を除く）の先頭から順に割り当てる
 * @remarks ID は呼び出すたびに新しく生成するため、返り値を複数回使い回してはならない
 */
export function createSampleRules(): Rule[] {
  const setting: Rule = {
    id: crypto.randomUUID(),
    name: "⚙設定",
    color: pickNewRuleColor([]),
    conditions: [urlContains("chrome://")],
  };
  const video: Rule = {
    id: crypto.randomUUID(),
    name: "📺️動画",
    color: pickNewRuleColor([setting]),
    conditions: [
      urlContains("youtube.com"),
      urlContains("nicovideo.jp"),
      urlContains("netflix.com"),
      urlContains("twitch.tv"),
    ],
  };
  const blog: Rule = {
    id: crypto.randomUUID(),
    name: "📃ブログ",
    color: pickNewRuleColor([setting, video]),
    conditions: [titleContains("ブログ"), urlContains("blog")],
  };

  return [setting, video, blog];
}
