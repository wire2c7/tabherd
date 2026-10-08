import type { BrowserContext, Page } from "@playwright/test";

import type { SettingsPageName } from "./fixtures";
import { expect, rule, shownNames, test } from "./fixtures";

// テストの名前は openspec/specs/rule-settings-ui/spec.md の Requirement（describe）と Scenario（test）に対応させる

const dev = rule("dev", "開発", "blue");
const pageNames: readonly SettingsPageName[] = ["popup", "options"];

/** chrome.storage.local.get の実装を差し替える。元の実装は area.get に残したまま呼べる */
interface FailableStorageArea {
  get: (keys?: unknown) => Promise<unknown>;
}

interface OpenWithFailingLoadOptions {
  context: BrowserContext;
  extensionId: string;
  name: SettingsPageName;
  /** chrome.storage.local.get("rules") を失敗させる回数 */
  remaining: number;
}

/**
 * chrome.storage.local.get("rules") を remaining 回だけ失敗させてから設定画面を開く。
 * 追加ボタンが有効になるのを待つ openSettings は使わず、直接ページを開く
 */
async function openWithFailingLoad({
  context,
  extensionId,
  name,
  remaining,
}: OpenWithFailingLoadOptions): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript((failuresLeft: number) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- chrome.storage.local.get はオーバーロードを持つ型のため、unknown を経由してテスト用の単純な関数で一時的に差し替える
    const area = chrome.storage.local as unknown as FailableStorageArea;
    const original = area.get.bind(area);
    let left = failuresLeft;
    area.get = async (keys?: unknown) => {
      if (keys === "rules" && left > 0) {
        left -= 1;
        throw new Error("storage unavailable (e2e test)");
      }
      return original(keys);
    };
  }, remaining);
  if (name === "popup") {
    // Chrome のポップアップの幅（entrypoints/popup/style.css）と最大の高さ
    await page.setViewportSize({ width: 400, height: 600 });
  }
  await page.goto(`chrome-extension://${extensionId}/${name}.html`);
  return page;
}

test.describe("ルールの読み込みの失敗", () => {
  // わざと読み込みを失敗させるため、console.error に出るログ（「ルールの一覧を読み込めませんでした」）に加え、
  // @wxt-dev/storage が defineItem 時に投げっぱなしで呼ぶ内部のキャッシュの温め（migrationsDone.then(getOrInitValue)、
  // .catch が無い）が、chrome.storage.local.get の失敗をそのまま weberror（未処理の Promise の拒否）として漏らす。
  // どちらも同じ注入した失敗（storage unavailable (e2e test)）が原因のため、まとめて許容する
  test.use({ expectedErrors: [/storage unavailable \(e2e test\)/u] });

  for (const name of pageNames) {
    test(`読み込みが失敗する（${name}）`, async ({ context, extensionId }) => {
      const page = await openWithFailingLoad({ context, extensionId, name, remaining: Number.MAX_SAFE_INTEGER });

      await expect(page.getByText("保存されたルールを読み込めませんでした")).toBeVisible();
      await expect(page.getByRole("button", { name: "＋ ルールを追加" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "再読み込み" })).toBeVisible();
    });
  }

  test("再読み込みに成功する", async ({ context, extensionId, setStoredRules, storedRules }) => {
    await setStoredRules([dev]);
    // @wxt-dev/storage は defineItem 時に内部でキャッシュを温めるため get("rules") が1回余分に呼ばれる。
    // それも含めて2回目の呼び出し（＝利用者が押す「再読み込み」）で読み込みに成功させる
    const page = await openWithFailingLoad({ context, extensionId, name: "options", remaining: 2 });
    await expect(page.getByText("保存されたルールを読み込めませんでした")).toBeVisible();

    await page.getByRole("button", { name: "再読み込み" }).click();

    await expect(page.getByRole("button", { name: "＋ ルールを追加" })).toBeEnabled();
    expect(await shownNames(page)).toStrictEqual(["開発"]);
    // 再読み込みは保存されたルールを書き換えない
    expect(await storedRules()).toStrictEqual([dev]);
  });

  test("再読み込みに失敗する", async ({ context, extensionId }) => {
    const page = await openWithFailingLoad({
      context,
      extensionId,
      name: "options",
      remaining: Number.MAX_SAFE_INTEGER,
    });
    await expect(page.getByText("保存されたルールを読み込めませんでした")).toBeVisible();

    await page.getByRole("button", { name: "再読み込み" }).click();

    await expect(page.getByText("保存されたルールを読み込めませんでした")).toBeVisible();
    await expect(page.getByRole("button", { name: "＋ ルールを追加" })).toBeDisabled();
  });
});
