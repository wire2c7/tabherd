/** createSettleGate が返す、変更の通知と、進行中のデバウンスの確定待ち */
export interface SettleGate {
  /** 値が変わるたびに呼ぶ */
  touch: () => void;
  /** 保留中の変更が無ければ即座に、あれば最後の touch から ms 経って確定するまで解決する */
  waitUntilSettled: () => Promise<void>;
}

/**
 * 最後の touch から ms のあいだ次の touch がなければ確定したとみなすゲートを作る。
 *
 * @param ms - 確定までの間隔（ミリ秒）
 * @returns 変更の通知（touch）と、進行中のデバウンスの確定待ち（waitUntilSettled）
 */
export function createSettleGate(ms: number): SettleGate {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settling: PromiseWithResolvers<null> | undefined;

  function touch(): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const resolved = settling;
      settling = undefined;
      resolved?.resolve(null);
    }, ms);
  }

  async function waitUntilSettled(): Promise<void> {
    if (timer === undefined) {
      return;
    }
    settling ??= Promise.withResolvers<null>();
    await settling.promise;
  }

  return { touch, waitUntilSettled };
}
