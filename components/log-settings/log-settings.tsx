import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { browser } from "wxt/browser";

import { MAX_STORED_LOGS, logsItem } from "../../utils/logging/storage";
import { buildLogExport } from "./export";

import "./log-settings.css";

/** 端末に保存したログの件数。読み込みが終わるまでは null */
function useStoredLogCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const unwatch = logsItem.watch((logs) => {
      setCount(logs.length);
    });
    async function load(): Promise<void> {
      const logs = await logsItem.getValue();
      setCount(logs.length);
    }
    void load();
    return unwatch;
  }, []);
  return count;
}

/** ファイルとしてダウンロードさせる。downloads の権限を使わないよう、リンクのクリックで保存させる */
function download(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportLogs(): Promise<void> {
  const { fileName, content } = buildLogExport(await logsItem.getValue(), {
    extensionVersion: browser.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    now: new Date(),
  });
  download(fileName, content);
}

/** ログに記録するもの・しないもの。オプションページで利用者に示す */
function LogContents(): JSX.Element {
  return (
    <div class="log-settings__lists">
      <div>
        <h3 class="log-settings__subtitle">記録するもの</h3>
        <ul class="log-settings__list">
          <li>時刻、処理の種類</li>
          <li>タブ・グループ・ウィンドウの ID、件数</li>
          <li>エラーの内容</li>
          <li>拡張機能とブラウザのバージョン</li>
        </ul>
      </div>
      <div>
        <h3 class="log-settings__subtitle">記録しないもの</h3>
        <ul class="log-settings__list">
          <li>タブの URL・タイトル</li>
          <li>グループ名、ルールの内容</li>
        </ul>
      </div>
    </div>
  );
}

/** ログの書き出し・消去の操作と、保存されたログの件数 */
function LogActions(): JSX.Element {
  const count = useStoredLogCount();
  return (
    <div class="log-settings__actions">
      <button
        type="button"
        onClick={() => {
          void exportLogs();
        }}
      >
        ログを保存
      </button>
      <button
        type="button"
        class="danger"
        disabled={count === 0}
        onClick={() => {
          void logsItem.removeValue();
        }}
      >
        ログを消去
      </button>
      <span class="hint" aria-live="polite">
        {count === null ? "読み込み中…" : `保存されたログ：${count} 件`}
      </span>
    </div>
  );
}

/** ログの説明と、書き出し・消去の操作。オプションページだけで描画する */
export function LogSettings(): JSX.Element {
  return (
    <section class="log-settings" aria-labelledby="log-settings-title">
      <h2 id="log-settings-title" class="log-settings__title">
        ログ
      </h2>
      <p class="log-settings__text">
        不具合の調査のため、エラーが起きたときに、その直前の処理の記録をこの端末に保存します。
      </p>
      <LogContents />
      <p class="log-settings__text">
        {
          // JSX のテキストの途中で改行すると半角スペースになるため、1つの文字列にする
          `ログはこの端末にのみ保存され、自動で送信されることはありません。保存するのは直近 ${MAX_STORED_LOGS} 件までです。不具合を報告する際は「ログを保存」で書き出したファイルを添付してください。`
        }
      </p>
      <LogActions />
    </section>
  );
}
