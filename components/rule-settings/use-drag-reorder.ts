import type { RefObject, TargetedDragEvent } from "preact";
import { useState } from "preact/hooks";

import { findDropSlot, slotToIndex } from "./reorder";

export interface DragReorder {
  /** ドラッグ中のルールの id */
  draggingId: string | null;
  /** 差し込み先を示す隙間の番号（findDropSlot を参照）。移動しても並びが変わらない位置では null */
  dropSlot: number | null;
  /** ドラッグのハンドルの dragstart */
  handleDragStart: (event: TargetedDragEvent<HTMLElement>, id: string) => void;
  /** 一覧（ol）の dragover */
  handleDragOver: (event: TargetedDragEvent<HTMLOListElement>) => void;
  /** 一覧（ol）の drop */
  handleDrop: (event: TargetedDragEvent<HTMLOListElement>) => void;
  /** ドラッグのハンドルの dragend。ドロップ・キャンセルのどちらでも来る */
  handleDragEnd: () => void;
}

/**
 * HTML5 Drag and Drop でのルールの並び替え。
 *
 * @param listRef - ルールの一覧（ol）の ref
 * @param ids - 表示順のルールの id の一覧
 * @param onMove - ドロップでルールを動かすときに呼ぶ関数
 * @returns ドラッグ・ドロップの状態とハンドラ
 * @remarks 一覧（listRef）の直下の要素をルールの並びとみなし、ポインターの位置から差し込み先を決める。ルールの間の隙間でもドロップできるよう、dragover・drop は各ルールではなく一覧で受ける
 */
export function useDragReorder(
  listRef: RefObject<HTMLOListElement>,
  ids: readonly string[],
  onMove: (id: string, to: number) => void,
): DragReorder {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  function slotAt(pointerY: number): number | null {
    const from = draggingId === null ? -1 : ids.indexOf(draggingId);
    return listRef.current === null ? null : findSlot(listRef.current, from, pointerY);
  }

  function handleDragStart(event: TargetedDragEvent<HTMLElement>, id: string): void {
    startDrag(event, id);
    setDraggingId(id);
  }

  function handleDragOver(event: TargetedDragEvent<HTMLOListElement>): void {
    // ほかの要素・ページからのドラッグ（テキスト等）は受け付けない
    if (draggingId === null) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = "move";
    }
    // dragover は高頻度で来るが、同じ値での state の更新では再描画されない
    setDropSlot(slotAt(event.clientY));
  }

  function handleDrop(event: TargetedDragEvent<HTMLOListElement>): void {
    if (draggingId === null) {
      return;
    }
    event.preventDefault();
    const slot = slotAt(event.clientY);
    if (slot !== null) {
      onMove(draggingId, slotToIndex(ids.indexOf(draggingId), slot));
    }
    handleDragEnd();
  }

  function handleDragEnd(): void {
    setDraggingId(null);
    setDropSlot(null);
  }

  return { draggingId, dropSlot, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}

/** ドラッグするデータと画像を設定する */
function startDrag(event: TargetedDragEvent<HTMLElement>, id: string): void {
  const { dataTransfer } = event;
  if (dataTransfer === null) {
    return;
  }
  dataTransfer.effectAllowed = "move";
  // Firefox は何かデータを持たせないとドラッグを始めない。text/plain にすると入力欄や外へのドロップで id が貼り付くため、独自の種類にする
  dataTransfer.setData("application/x-tabherd-rule-id", id);
  // ハンドルだけでなくルール全体をドラッグ中の画像にする
  const item = event.currentTarget.closest("li");
  if (item !== null) {
    const rect = item.getBoundingClientRect();
    dataTransfer.setDragImage(item, event.clientX - rect.left, event.clientY - rect.top);
  }
}

/** from 番目の項目を差し込む隙間の番号。from が範囲外のときと、移動しても並びが変わらない隙間では null */
function findSlot(list: HTMLOListElement, from: number, pointerY: number): number | null {
  if (from === -1) {
    return null;
  }
  const centers = [...list.children].map((item) => {
    const rect = item.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  const slot = findDropSlot(centers, pointerY);
  return slotToIndex(from, slot) === from ? null : slot;
}
