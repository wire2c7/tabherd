/** オプションページから background へ、端末に保存したログの消去を依頼するメッセージ */
export interface ClearLogsMessage {
  type: "clear-logs";
}

/** ログの消去の依頼への返事 */
export type ClearLogsResponse = { ok: true } | { ok: false; error: string };

export function isClearLogsMessage(message: unknown): message is ClearLogsMessage {
  return typeof message === "object" && message !== null && "type" in message && message.type === "clear-logs";
}
