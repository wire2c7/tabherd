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
