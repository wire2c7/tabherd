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
    // 前提: debug・info のログだけを出す（warning 以上が無い）
    // 検証: 端末（storage）には1件も保存されない
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
    // 前提: debug で判定した後に warn で警告を出す
    // 検証: 端末に debug・warning の両方が、レベル・カテゴリ・メッセージ付きで、出た順に保存される
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
    // 前提: 警告（保存済みになる）と直前の debug（メモリに溜まるだけ）を出してから clear を呼び、その後にも警告を出す
    // 検証: 消去前のログは残らず、消去後に出した警告だけが保存される
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
    // 前提: removeValue が例外を投げて消去に失敗する。直前に debug のログがある状態で消去を試みる
    // 検証: clear() は失敗（reject）するが、消去前の debug のログはメモリに戻り、消去後の警告と一緒に保存される
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
    // 前提: dev: true で設定し、debug レベルのログを出す
    // 検証: console.debug が1回呼ばれる
    const logs = prepare();
    const debug = vi.spyOn(console, "debug").mockReturnValue();
    configureLogging({ dev: true, logs });
    getAppLogger("grouping").debug("判定する");
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("リリース版では warning より下を console に出さない", () => {
    // 前提: dev: false で設定し、debug・info・warning の3レベルを出す
    // 検証: console.debug・console.info は呼ばれず、console.warn だけが1回呼ばれる
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
