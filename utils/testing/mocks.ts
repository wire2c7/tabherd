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
