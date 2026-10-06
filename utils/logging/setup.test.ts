import { resetSync } from "@logtape/logtape";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { MemoryStorageItem } from "../testing/storage";
import { createMemoryStorageItem } from "../testing/storage";
import { configureLogging, getAppLogger } from "./setup";
import type { StoredLogEntry } from "./storage";
import { LOGS_ITEM, readStoredLogs } from "./storage";

/**
 * ログを保存する StorageItem を作り、テストの終わりにロガーの設定を戻すよう登録する（テストが失敗しても戻す）。
 * configureSync は設定済みだと例外を投げるため、ロガーを設定するテストの最初に呼ぶ
 */
function prepare(): MemoryStorageItem<StoredLogEntry[]> {
  onTestFinished(() => {
    resetSync();
  });
  return createMemoryStorageItem(LOGS_ITEM);
}

describe("ロガーの設定：端末への保存", () => {
  it("警告が出るまでは端末に保存しない", async () => {
    const logs = prepare();
    vi.spyOn(console, "debug").mockReturnValue();
    vi.spyOn(console, "info").mockReturnValue();
    const { settled } = configureLogging({ dev: true, logs });
    const logger = getAppLogger("grouping");
    logger.debug("判定する");
    logger.info("操作する");
    await settled();
    await expect(readStoredLogs(logs)).resolves.toStrictEqual([]);
  });

  it("警告が出たら、直前のログと一緒に端末に保存する", async () => {
    const logs = prepare();
    vi.spyOn(console, "warn").mockReturnValue();
    const { settled } = configureLogging({ dev: false, logs });
    const logger = getAppLogger("grouping");
    logger.debug("タブ {tabId} を判定する", { tabId: 3 });
    logger.warn("操作に失敗した", { error: new Error("No tab with id: 3.") });
    await settled();
    const stored = await readStoredLogs(logs);
    expect(stored.map((entry) => [entry.level, entry.category, entry.message])).toStrictEqual([
      ["debug", "tabherd.grouping", "タブ 3 を判定する"],
      ["warning", "tabherd.grouping", "操作に失敗した"],
    ]);
  });
});

describe("ロガーの設定：消去", () => {
  it("保存済みのログと、メモリに溜めた直前のログを消す", async () => {
    const logs = prepare();
    vi.spyOn(console, "warn").mockReturnValue();
    const { clear, settled } = configureLogging({ dev: false, logs });
    const logger = getAppLogger("grouping");
    logger.warn("消去の前の警告");
    logger.debug("消去の前の判定");
    await clear();
    logger.warn("消去の後の警告");
    await settled();
    const stored = await readStoredLogs(logs);
    expect(stored.map((entry) => entry.message)).toStrictEqual(["消去の後の警告"]);
  });

  it("消せなかったら、メモリに溜めた直前のログを戻す", async () => {
    const logs = prepare();
    vi.spyOn(console, "warn").mockReturnValue();
    vi.spyOn(logs, "removeValue").mockRejectedValueOnce(new Error("容量不足"));
    const { clear, settled } = configureLogging({ dev: false, logs });
    const logger = getAppLogger("grouping");
    logger.debug("消去の前の判定");
    await expect(clear()).rejects.toThrow("容量不足");
    logger.warn("消去の後の警告");
    await settled();
    const stored = await readStoredLogs(logs);
    expect(stored.map((entry) => entry.message)).toStrictEqual(["消去の前の判定", "消去の後の警告"]);
  });
});

describe("ロガーの設定：console への出力", () => {
  it("開発ビルドでは debug 以上を console に出す", () => {
    const logs = prepare();
    const debug = vi.spyOn(console, "debug").mockReturnValue();
    configureLogging({ dev: true, logs });
    getAppLogger("grouping").debug("判定する");
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("リリース版では warning より下を console に出さない", () => {
    const logs = prepare();
    const debug = vi.spyOn(console, "debug").mockReturnValue();
    const info = vi.spyOn(console, "info").mockReturnValue();
    const warn = vi.spyOn(console, "warn").mockReturnValue();
    configureLogging({ dev: false, logs });
    const logger = getAppLogger("grouping");
    logger.debug("判定する");
    logger.info("操作する");
    logger.warn("失敗した");
    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
