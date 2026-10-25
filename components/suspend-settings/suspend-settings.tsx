import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import { watchAndLoad } from "../watch-and-load";

import "./suspend-settings.css";

export interface SuspendSettingsProps {
  /** 「サスペンド前に確認する」設定の読み書き先 */
  store: SuspendConfirmStore;
}

/** 設定の読み込みの状態。components/log-settings/count.ts の StoredLogCount と同じ形 */
type ConfirmLoad = { status: "loading" } | { status: "loaded"; enabled: boolean } | { status: "failed" };

/** store の設定を読み込み、変更を購読し、切り替える関数を返す */
function useSuspendConfirm(store: SuspendConfirmStore): { load: ConfirmLoad; toggle: () => void } {
  const [load, setLoad] = useState<ConfirmLoad>({ status: "loading" });

  useEffect(
    () =>
      watchAndLoad<boolean>({
        watch: store.watch,
        read: store.read,
        onChange: (value) => {
          setLoad({ status: "loaded", enabled: value });
        },
        onLoadFailed: (error) => {
          console.error("「サスペンド前に確認する」設定を読み込めませんでした", error);
          setLoad({ status: "failed" });
        },
      }),
    [store],
  );

  function toggle(): void {
    if (load.status !== "loaded") {
      return;
    }
    const previous = load.enabled;
    const next = !previous;
    setLoad({ status: "loaded", enabled: next });
    void (async () => {
      try {
        await store.write(next);
      } catch (error) {
        console.error("「サスペンド前に確認する」設定を保存できませんでした", error);
        // 保存できなければストレージには前の値が残っているため、表示も戻す
        setLoad({ status: "loaded", enabled: previous });
      }
    })();
  }

  return { load, toggle };
}

/**
 * 「サスペンド前に確認する」設定のチェックボックス。
 *
 * @param props - 設定の読み書き先
 * @returns 設定のセクション
 * @remarks オプションページだけで描画する
 */
export function SuspendSettings({ store }: SuspendSettingsProps): JSX.Element {
  const { load, toggle } = useSuspendConfirm(store);

  return (
    <section class="suspend-settings" aria-labelledby="suspend-settings-title">
      <h2 id="suspend-settings-title" class="suspend-settings__title">
        サスペンド
      </h2>
      <label class="suspend-settings__checkbox">
        <input
          type="checkbox"
          checked={load.status === "loaded" && load.enabled}
          disabled={load.status !== "loaded"}
          onChange={toggle}
        />
        サスペンド前に確認する
      </label>
      {load.status === "failed" && <p class="error">設定を読み込めませんでした。</p>}
    </section>
  );
}
