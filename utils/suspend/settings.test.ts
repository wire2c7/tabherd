import { describe, expect, it, vi } from "vitest";

import { createMemoryStorageItem } from "../testing/storage";
import { SUSPEND_CONFIRM_ITEM, createSuspendConfirmStore, parseSuspendConfirm } from "./settings";

describe("保存値からの「サスペンド前に確認する」設定の読み取り", () => {
  it("真偽値ならその値を返す", () => {
    // 検証: true・false のどちらもそのまま返る
    expect(parseSuspendConfirm(true)).toBe(true);
    expect(parseSuspendConfirm(false)).toBe(false);
  });

  it("保存値が真偽値でなければ true を返す", () => {
    // 前提: 文字列・null はどちらも boolean() の検証を通らない / 検証: fallback の true になる
    expect(parseSuspendConfirm("true")).toBe(true);
    expect(parseSuspendConfirm(null)).toBe(true);
  });
});

describe("保存した「サスペンド前に確認する」設定の読み書き", () => {
  it("read は壊れた保存値を true に直す", async () => {
    // 前提: 保存値が文字列（壊れている） / 検証: read() は true を返す
    const item = createMemoryStorageItem(SUSPEND_CONFIRM_ITEM);
    item.store("broken");
    const store = createSuspendConfirmStore(item);
    await expect(store.read()).resolves.toBe(true);
  });

  it("write した値を read で読み直せる", async () => {
    // 前提/検証: write(false) の後、read() は false を返す
    const store = createSuspendConfirmStore(createMemoryStorageItem(SUSPEND_CONFIRM_ITEM));
    await store.write(false);
    await expect(store.read()).resolves.toBe(false);
  });

  it("watch は検証済みの値を通知する", () => {
    // 前提: 変更の通知に壊れた値が来る / 検証: listener には fallback の true が渡る
    const item = createMemoryStorageItem(SUSPEND_CONFIRM_ITEM);
    const store = createSuspendConfirmStore(item);
    const listener = vi.fn<(value: boolean) => void>();
    store.watch(listener);
    item.store("broken");
    expect(listener).toHaveBeenCalledWith(true);
  });
});
