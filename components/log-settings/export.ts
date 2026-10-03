import type { StoredLogEntry } from "../../utils/logging/storage";

/** 書き出すログのファイルの中身 */
export interface LogExport {
  extensionVersion: string;
  /** Chrome の版。User-Agent の全体は OS も含むため、版だけを入れる */
  browserVersion: string | null;
  /** ISO 8601 の日時 */
  exportedAt: string;
  logs: readonly StoredLogEntry[];
}

export interface LogExportEnvironment {
  extensionVersion: string;
  userAgent: string;
  now: Date;
}

/** User-Agent から Chrome の版を取り出す。見つからなければ null */
export function parseBrowserVersion(userAgent: string): string | null {
  return /\bChrome\/(?<version>[\d.]+)/u.exec(userAgent)?.groups?.["version"] ?? null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ファイル名に入れる日時。利用者が問題の起きた時刻と照らし合わせられるよう、ローカルの時刻で 20261002-010203 の形にする */
function fileNameStamp(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** 書き出すログのファイルの名前と中身を組み立てる */
export function buildLogExport(
  logs: readonly StoredLogEntry[],
  { extensionVersion, userAgent, now }: LogExportEnvironment,
): { fileName: string; content: string } {
  const data: LogExport = {
    extensionVersion,
    browserVersion: parseBrowserVersion(userAgent),
    exportedAt: now.toISOString(),
    logs,
  };
  return { fileName: `tabherd-logs-${fileNameStamp(now)}.json`, content: `${JSON.stringify(data, null, 2)}\n` };
}
