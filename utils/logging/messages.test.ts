import { describe, expect, it } from "vitest";

import { isClearLogsMessage } from "./messages";

describe("ログの消去の依頼のメッセージ", () => {
  it("消去の依頼を見分ける", () => {
    expect(isClearLogsMessage({ type: "clear-logs" })).toBe(true);
  });

  it.each([null, "clear-logs", {}, { type: "other" }])("ほかの値 %j は消去の依頼として扱わない", (message) => {
    expect(isClearLogsMessage(message)).toBe(false);
  });
});
