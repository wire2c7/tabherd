import type { MutableRef } from "preact/hooks";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { RULES_ITEM, createRulesStore } from "../../utils/rules/storage";
import type { Rule } from "../../utils/rules/types";
import { createMemoryStorageItem } from "../../utils/testing/storage";
import type { RulesLoad } from "./use-rules";
import { subscribeRules } from "./use-rules";

const DEV: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };

function loaded(rules: readonly Rule[]): RulesLoad {
  return { status: "loaded", rules };
}

/** subscribeRules を始め、渡された読み込みの状態を順に入れた配列と、もう一度読み込む関数を返す。購読はテストの終わりにやめる */
function subscribe(store: ReturnType<typeof createRulesStore>): { loads: RulesLoad[]; retry: () => Promise<void> } {
  const loads: RulesLoad[] = [];
  const latest: MutableRef<readonly Rule[] | null> = { current: null };
  const pendingWrites: MutableRef<number> = { current: 0 };
  const subscription = subscribeRules(store, {
    latest,
    pendingWrites,
    onChange: ({ rules }) => {
      loads.push(loaded(rules));
    },
    onLoadFailed: () => {
      loads.push({ status: "failed" });
    },
  });
  onTestFinished(subscription.unsubscribe);
  return { loads, retry: subscription.load };
}

describe("ルールの一覧の読み込み", () => {
  it("読み込みに成功したら、読み込んだ一覧を渡す", async () => {
    // 前提: 保存領域に DEV を保存してから購読を始める
    // 検証: 読み込んだ一覧（loaded([DEV])）が渡る
    const item = createMemoryStorageItem(RULES_ITEM);
    await item.setValue([DEV]);
    const { loads } = subscribe(createRulesStore(item));
    await vi.waitFor(() => {
      expect(loads).toStrictEqual([loaded([DEV])]);
    });
  });
});

describe("ルールの一覧の読み込みの失敗（Issue #74）", () => {
  it("読み込みに失敗したら、失敗を渡す", async () => {
    // 前提: store.read が1回だけ例外で reject する
    const store = createRulesStore(createMemoryStorageItem(RULES_ITEM));
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(store, "read").mockRejectedValueOnce(new Error("storage unavailable"));
    const { loads } = subscribe(store);

    // 検証: { status: "failed" } が渡り、失敗がログに残る
    await vi.waitFor(() => {
      expect(loads).toStrictEqual([{ status: "failed" }]);
    });
    expect(consoleError).toHaveBeenCalledWith("ルールの一覧を読み込めませんでした", expect.any(Error));
  });
});

describe("ルールの一覧の読み込みの失敗後の retry（Issue #74）", () => {
  it("失敗した後、retry で読み込みに成功したら、読み込んだ一覧を渡す", async () => {
    // 前提: 保存領域に DEV を保存し、store.read が最初の1回だけ失敗する
    const item = createMemoryStorageItem(RULES_ITEM);
    await item.setValue([DEV]);
    const store = createRulesStore(item);
    vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(store, "read").mockRejectedValueOnce(new Error("storage unavailable"));
    const { loads, retry } = subscribe(store);
    await vi.waitFor(() => {
      expect(loads).toStrictEqual([{ status: "failed" }]);
    });

    await retry();

    // 検証: 失敗の後に retry で読み込んだ一覧（loaded([DEV])）が続けて渡る
    expect(loads).toStrictEqual([{ status: "failed" }, loaded([DEV])]);
  });

  it("失敗した後、retry でも読み込みに失敗したら、失敗を渡し続ける", async () => {
    // 前提: store.read が呼ぶたびに失敗し続ける
    const store = createRulesStore(createMemoryStorageItem(RULES_ITEM));
    vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(store, "read").mockRejectedValue(new Error("storage unavailable"));
    const { loads, retry } = subscribe(store);
    await vi.waitFor(() => {
      expect(loads).toStrictEqual([{ status: "failed" }]);
    });

    await retry();

    // 検証: retry の後も { status: "failed" } が続けて渡る
    expect(loads).toStrictEqual([{ status: "failed" }, { status: "failed" }]);
  });
});

describe("ルールの一覧の読み込みの失敗と変更通知の重なり（Issue #74）", () => {
  it("読み込みより先に変更の通知が来たら、遅れて失敗した読み込みで上書きしない", async () => {
    // 前提: 最初の読み込みが失敗したまま止まるようにしてから、保存値が変わる
    const item = createMemoryStorageItem(RULES_ITEM);
    const store = createRulesStore(item);
    vi.spyOn(console, "error").mockReturnValue();
    const reading = Promise.withResolvers<never>();
    vi.spyOn(store, "read").mockReturnValueOnce(reading.promise);
    const { loads } = subscribe(store);

    await item.setValue([DEV]);
    await vi.waitFor(() => {
      expect(loads).toStrictEqual([loaded([DEV])]);
    });
    reading.reject(new Error("storage unavailable"));
    await expect(reading.promise).rejects.toThrow("storage unavailable");

    // 検証: 変更通知（loaded([DEV])）の後に、遅れて失敗した読み込みが失敗の状態で上書きしない
    expect(loads).toStrictEqual([loaded([DEV])]);
  });
});
