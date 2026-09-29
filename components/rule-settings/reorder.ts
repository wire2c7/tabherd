/** キーボード用の「上へ」「下へ」のボタンでの移動の向き */
export type MoveDirection = "up" | "down";

/**
 * ドラッグ中のポインターの位置から、差し込む隙間の番号を返す。
 * 隙間の番号は、先頭のルールの上を 0、n 番目のルールの下を n + 1 とする。
 * centers は一覧の各ルールの縦方向の中心の座標（上から順）
 */
export function findDropSlot(centers: readonly number[], pointerY: number): number {
  const slot = centers.findIndex((center) => pointerY < center);
  return slot === -1 ? centers.length : slot;
}

/** from 番目のルールを隙間 slot に差し込んだときの、移動後の位置 */
export function slotToIndex(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot;
}
