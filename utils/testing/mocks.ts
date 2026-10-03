import { onTestFinished, vi } from "vitest";

/**
 * このテストで vi.spyOn したモックを、テストの終わりに戻す（テストが失敗しても戻す）。
 * テストの最後で mockRestore を呼ぶと、途中の expect が失敗したときに戻らず、同じファイルの後のテストに残るため、spyOn の前に呼ぶ
 */
export function restoreMocksAfterTest(): void {
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
}

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
