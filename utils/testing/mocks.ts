import { onTestFinished, vi } from "vitest";

/**
 * このテストで偽のタイマーを使い、テストの終わりに本物のタイマーへ戻す（テストが失敗しても戻す）。
 * 戻さないと、同じファイルの後のテストの setTimeout が進まなくなる
 */
export function useFakeTimersInTest(): void {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/**
 * target[key] をこのテストのあいだ value に差し替え、終わりに元の値へ戻す（テストが失敗しても戻す）。
 *
 * @param target - 差し替える値を持つオブジェクト（fakeBrowser 等）
 * @param key - 差し替えるプロパティ
 * @param value - 差し替え後の値
 * @remarks vi.spyOn ではコールバック版のオーバーロードの型になるため、Promise 版の型の関数を代入したいときに使う
 */
export function stub<T, K extends keyof T>(target: T, key: K, value: T[K]): void {
  const original = target[key];
  target[key] = value;
  onTestFinished(() => {
    target[key] = original;
  });
}
