import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { browser } from "wxt/browser";

import type { LogsRequest, LogsResponse } from "../../utils/logging/messages";
import { requestLogs } from "../../utils/logging/messages";
import { MAX_STORED_LOGS, readStoredLogs } from "../../utils/logging/storage";
import { detectBrowser } from "./browser";
import type { StoredLogCount } from "./count";
import { canClearLogs, watchStoredLogCount } from "./count";
import { buildLogExport } from "./export";

import "./log-settings.css";

/** 端末に保存したログの件数の状態 */
function useStoredLogCount(): StoredLogCount {
  const [count, setCount] = useState<StoredLogCount>({ status: "loading" });
  useEffect(() => watchStoredLogCount(setCount), []);
  return count;
}

/** 件数の状態の表示 */
function describeCount(count: StoredLogCount): string {
  switch (count.status) {
    case "loading": {
      return "読み込み中…";
    }
    case "loaded": {
      return `保存されたログ：${count.count} 件`;
    }
    case "failed": {
      return "保存されたログの件数を読み込めませんでした";
    }
    default: {
      return count satisfies never;
    }
  }
}

/**
 * ダウンロードの後、Blob の URL を無効にするまで待つ時間（ミリ秒）。
 * click() が返った時点でブラウザが URL を読み終えているとは限らないため、すぐには無効にしない
 */
const REVOKE_DELAY_MS = 60_000;

/** ファイルとしてダウンロードさせる。downloads の権限を使わないよう、リンクのクリックで保存させる */
function download(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}

/** background にログについての依頼を送る */
async function sendLogsRequest(type: LogsRequest["type"]): Promise<LogsResponse> {
  return requestLogs(async (message) => browser.runtime.sendMessage(message), type);
}

async function exportLogs(): Promise<void> {
  // background が保存の途中のログを書き終えてから読む。待てなくても、保存済みのログは書き出せるため続ける
  const settled = await sendLogsRequest("settle-logs");
  if (!settled.ok) {
    console.warn("保存の途中のログを待てませんでした", settled.error);
  }
  const { fileName, content } = buildLogExport(await readStoredLogs(), {
    extensionVersion: browser.runtime.getManifest().version,
    browser: await detectBrowser(navigator),
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
          <li>拡張機能のバージョン、ブラウザの種類とバージョン</li>
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

/** 実行中のログの操作。実行中は二重に押せないよう、どちらのボタンも押せなくする */
type PendingOperation = "export" | "clear" | null;

/** ログの書き出し・消去の操作と、実行中の操作、直前の操作が失敗したときに表示するメッセージ */
function useLogOperations(): {
  pending: PendingOperation;
  failure: string | null;
  handleExport: () => Promise<void>;
  handleClear: () => Promise<void>;
} {
  const [pending, setPending] = useState<PendingOperation>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setPending("export");
    setFailure(null);
    try {
      await exportLogs();
    } catch (error) {
      console.error("ログを保存できませんでした", error);
      setFailure("ログを保存できませんでした。もう一度お試しください。");
    } finally {
      setPending(null);
    }
  }

  async function handleClear(): Promise<void> {
    setPending("clear");
    setFailure(null);
    // background の保存と同時に直接消すと、保存が消去の前の値を書き戻すため、保存と同じ待ち行列で消してもらう
    const response = await sendLogsRequest("clear-logs");
    setPending(null);
    if (!response.ok) {
      console.error("ログを消去できませんでした", response.error);
      setFailure("ログを消去できませんでした。もう一度お試しください。");
    }
  }

  return { pending, failure, handleExport, handleClear };
}

/** ログの書き出し・消去の操作と、保存されたログの件数 */
function LogActions(): JSX.Element {
  const count = useStoredLogCount();
  const { pending, failure, handleExport, handleClear } = useLogOperations();

  return (
    <div class="log-settings__actions">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => {
          void handleExport();
        }}
      >
        ログを保存
      </button>
      <button
        type="button"
        class="danger"
        disabled={pending !== null || !canClearLogs(count)}
        onClick={() => {
          void handleClear();
        }}
      >
        ログを消去
      </button>
      <span class={count.status === "failed" ? "error" : "hint"} aria-live="polite">
        {describeCount(count)}
      </span>
      {failure !== null && (
        <span class="error" role="alert">
          {failure}
        </span>
      )}
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
