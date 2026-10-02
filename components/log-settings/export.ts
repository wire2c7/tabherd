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

/** 書き出すログのファイルの名前と中身を組み立てる */
export function buildLogExport(
  logs: readonly StoredLogEntry[],
  { extensionVersion, userAgent, now }: LogExportEnvironment,
): { fileName: string; content: string } {
  const exportedAt = now.toISOString();
  const data: LogExport = {
    extensionVersion,
    browserVersion: parseBrowserVersion(userAgent),
    exportedAt,
    logs,
  };
  // 2026-10-02T01:02:03.000Z → 20261002-010203
  const stamp = exportedAt.slice(0, 19).replaceAll("-", "").replaceAll(":", "").replace("T", "-");
  return { fileName: `tabherd-logs-${stamp}.json`, content: `${JSON.stringify(data, null, 2)}\n` };
}
