import { resetSync } from "@logtape/logtape";
import { describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { configureLogging, getAppLogger } from "./setup";
import { logsItem } from "./storage";

/** 前のテストのロガーの設定と console のモックを戻す。configureSync は設定済みだと例外を投げる */
function reset(): void {
  resetSync();
  vi.restoreAllMocks();
  fakeBrowser.reset();
}

describe("ロガーの設定：端末への保存", () => {
  it("警告が出るまでは端末に保存しない", async () => {
    reset();
    vi.spyOn(console, "debug").mockReturnValue();
    vi.spyOn(console, "info").mockReturnValue();
    const { settled } = configureLogging({ dev: true });
    const logger = getAppLogger("grouping");
    logger.debug("判定する");
    logger.info("操作する");
    await settled();
    await expect(logsItem.getValue()).resolves.toStrictEqual([]);
  });

  it("警告が出たら、直前のログと一緒に端末に保存する", async () => {
    reset();
    vi.spyOn(console, "warn").mockReturnValue();
    const { settled } = configureLogging({ dev: false });
    const logger = getAppLogger("grouping");
    logger.debug("タブ {tabId} を判定する", { tabId: 3 });
    logger.warning("操作に失敗した", { error: new Error("No tab with id: 3.") });
    await settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => [entry.level, entry.category, entry.message])).toStrictEqual([
      ["debug", "tabherd.grouping", "タブ 3 を判定する"],
      ["warning", "tabherd.grouping", "操作に失敗した"],
    ]);
  });
});

describe("ロガーの設定：消去", () => {
  it("保存済みのログと、メモリに溜めた直前のログを消す", async () => {
    reset();
    vi.spyOn(console, "warn").mockReturnValue();
    const { clear, settled } = configureLogging({ dev: false });
    const logger = getAppLogger("grouping");
    logger.warning("消去の前の警告");
    logger.debug("消去の前の判定");
    await clear();
    logger.warning("消去の後の警告");
    await settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["消去の後の警告"]);
  });
});

describe("ロガーの設定：console への出力", () => {
  it("開発ビルドでは debug 以上を console に出す", () => {
    reset();
    const debug = vi.spyOn(console, "debug").mockReturnValue();
    configureLogging({ dev: true });
    getAppLogger("grouping").debug("判定する");
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("リリース版では warning より下を console に出さない", () => {
    reset();
    const debug = vi.spyOn(console, "debug").mockReturnValue();
    const info = vi.spyOn(console, "info").mockReturnValue();
    const warn = vi.spyOn(console, "warn").mockReturnValue();
    configureLogging({ dev: false });
    const logger = getAppLogger("grouping");
    logger.debug("判定する");
    logger.info("操作する");
    logger.warning("失敗した");
    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
