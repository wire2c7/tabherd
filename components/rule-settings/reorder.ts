/** キーボード用の「上へ」「下へ」のボタンでの移動の向き */
export type MoveDirection = "up" | "down";

/**
 * ドラッグ中のポインターの位置から、差し込む隙間の番号を返す。
 *
 * @param centers - 一覧の各ルールの縦方向の中心の座標（上から順）
 * @param pointerY - ポインターの縦方向の座標
 * @returns 差し込む隙間の番号
 * @remarks 隙間の番号は、先頭のルールの上を 0、n 番目のルールの下を n + 1 とする
 */
export function findDropSlot(centers: readonly number[], pointerY: number): number {
  const slot = centers.findIndex((center) => pointerY < center);
  return slot === -1 ? centers.length : slot;
}

/**
 * from 番目のルールを隙間 slot に差し込んだときの、移動後の位置を返す。
 *
 * @param from - 動かすルールの元の位置
 * @param slot - 差し込む隙間の番号
 * @returns 移動後の位置
 */
export function slotToIndex(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot;
}
