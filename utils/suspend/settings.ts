import type { InferOutput } from "valibot";
import { boolean, safeParse } from "valibot";

import type { StorageItem, StorageItemDefinition } from "../storage/item";

/** 「サスペンド前に確認する」設定の保存値の形 */
export const SuspendConfirmSchema = boolean();

export type SuspendConfirm = InferOutput<typeof SuspendConfirmSchema>;

/** 保存されていないときは確認を有効（ON）にする（spec.md の「確認表示のON/OFF設定」） */
const FALLBACK_SUSPEND_CONFIRM: SuspendConfirm = true;

/** 「サスペンド前に確認する」設定 */
export const SUSPEND_CONFIRM_ITEM: StorageItemDefinition<boolean> = {
  key: "local:suspendConfirm",
  fallback: FALLBACK_SUSPEND_CONFIRM,
};

/**
 * 保存値を「サスペンド前に確認する」設定の値に直す。
 *
 * @param value - 保存値
 * @returns 真偽値ならその値、そうでなければ fallback（true）
 */
export function parseSuspendConfirm(value: unknown): SuspendConfirm {
  const parsed = safeParse(SuspendConfirmSchema, value);
  return parsed.success ? parsed.output : FALLBACK_SUSPEND_CONFIRM;
}

/** 保存した「サスペンド前に確認する」設定の読み書き */
export interface SuspendConfirmStore {
  /** 保存値を読む。壊れていれば true として扱う */
  read: () => Promise<SuspendConfirm>;
  write: (value: SuspendConfirm) => Promise<void>;
  /** 保存値の変更を通知する。購読を解除する関数を返す */
  watch: (listener: (value: SuspendConfirm) => void) => () => void;
}

/**
 * SUSPEND_CONFIRM_ITEM の StorageItem から SuspendConfirmStore を作る。
 *
 * @param item - 保存先の StorageItem
 * @returns 保存した「サスペンド前に確認する」設定の読み書き
 */
export function createSuspendConfirmStore(item: StorageItem<boolean>): SuspendConfirmStore {
  return {
    read: async () => parseSuspendConfirm(await item.getValue()),
    write: async (value) => item.setValue(value),
    watch: (listener) => item.watch((newValue) => listener(parseSuspendConfirm(newValue))),
  };
}
