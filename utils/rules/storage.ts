import { storage } from "wxt/utils/storage";

import type { Rule } from "./types";

/** ルールの一覧。データの形を変えるときは version を上げて migrations を書く */
export const rulesItem = storage.defineItem<Rule[]>("local:rules", {
  fallback: [],
  version: 1,
});
