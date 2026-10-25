import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import type { SuspendTabsApi } from "../../utils/suspend/tabs";
import type { GroupView } from "./groups";
import { buildGroupViews } from "./groups";
import { suspendGroup } from "./suspend";

import "./suspend-groups.css";

export interface SuspendGroupsProps {
  /** タブグループの取得・サスペンドの実行先 */
  api: SuspendTabsApi;
  /** 確認表示設定の読み先 */
  confirmStore: SuspendConfirmStore;
}

/** 一覧の読み込みの状態。components/rule-settings/use-rules.ts の RulesLoad と同じ形 */
type GroupsLoad = { status: "loading" } | { status: "loaded"; groups: GroupView[] } | { status: "failed" };

/** props.api からタブグループの一覧を読み込む。popup を開いたときに一度だけ読み込む（design.md の Non-Goals） */
function useWindowGroups(api: SuspendTabsApi): GroupsLoad {
  const [load, setLoad] = useState<GroupsLoad>({ status: "loading" });
  useEffect(() => {
    void (async () => {
      try {
        const groups = await api.queryWindowGroups();
        setLoad({ status: "loaded", groups: buildGroupViews(groups) });
      } catch (error) {
        console.error("タブグループを読み込めませんでした", error);
        setLoad({ status: "failed" });
      }
    })();
  }, [api]);
  return load;
}

/** 確認ダイアログを window.confirm() で表示する（design.md の決定）。globalThis 経由で呼ぶのは unicorn/prefer-global-this のため */
function confirmWithDialog(message: string): boolean {
  // oxlint-disable-next-line eslint/no-alert -- design.md の決定どおり、確認は window.confirm() を使う
  return globalThis.confirm(message);
}

/** サスペンドの実行中のグループ ID（実行中でなければ null）と、実行する関数 */
function useSuspendAction(
  api: SuspendTabsApi,
  confirmStore: SuspendConfirmStore,
): { pendingId: number | null; suspend: (group: GroupView) => void } {
  const [pendingId, setPendingId] = useState<number | null>(null);

  function suspend(group: GroupView): void {
    setPendingId(group.id);
    void (async () => {
      try {
        await suspendGroup(group, { api, confirmStore, confirm: confirmWithDialog });
      } catch (error) {
        console.error("タブグループをサスペンドできませんでした", error);
      } finally {
        setPendingId(null);
      }
    })();
  }

  return { pendingId, suspend };
}

/**
 * タブグループ一覧と、グループごとのサスペンド操作。
 *
 * @param props - タブグループの取得・サスペンドの実行先と、確認表示設定の読み先
 * @returns タブグループの一覧とサスペンドボタンを表示するセクション
 * @remarks ポップアップでだけ描画する
 */
export function SuspendGroups({ api, confirmStore }: SuspendGroupsProps): JSX.Element {
  const load = useWindowGroups(api);
  const { pendingId, suspend } = useSuspendAction(api, confirmStore);

  if (load.status === "loading") {
    return <p class="hint">読み込み中…</p>;
  }
  if (load.status === "failed") {
    return <p class="error">タブグループを読み込めませんでした。</p>;
  }
  return (
    <section class="suspend-groups" aria-labelledby="suspend-groups-title">
      <h2 id="suspend-groups-title" class="suspend-groups__title">
        タブグループ
      </h2>
      {load.groups.length === 0 ? (
        <p class="suspend-groups__empty">このウィンドウにタブグループはありません。</p>
      ) : (
        <ul class="suspend-groups__list">
          {load.groups.map((group) => (
            <li key={group.id} class="suspend-groups__item">
              <span class="swatch" data-color={group.color} aria-hidden="true" />
              <span class="suspend-groups__name">{group.title}</span>
              <span class="suspend-groups__count hint">{`${group.tabCount} タブ`}</span>
              <button
                type="button"
                disabled={pendingId === group.id || group.targetTabIds.length === 0}
                onClick={() => {
                  suspend(group);
                }}
              >
                サスペンド
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
