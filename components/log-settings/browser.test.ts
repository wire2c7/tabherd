import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { NavigatorLike } from "./browser";
import { detectBrowser, parseBrowserFromUserAgent, pickBrowserBrand } from "./browser";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const FULL_VERSION_LIST = [
  { brand: "Not)A;Brand", version: "8.0.0.0" },
  { brand: "Chromium", version: "141.0.7390.54" },
  { brand: "Google Chrome", version: "141.0.7390.54" },
];

type GetHighEntropyValues = NonNullable<NavigatorLike["userAgentData"]>["getHighEntropyValues"];

/** getHighEntropyValues を持つ navigator.userAgentData がある navigator */
function withUserAgentData(getHighEntropyValues: GetHighEntropyValues): NavigatorLike {
  return { userAgent: USER_AGENT, userAgentData: { getHighEntropyValues } };
}

describe("fullVersionList からのブラウザの選択", () => {
  it("chromium 以外の種類があれば、そちらを選ぶ", () => {
    // 前提: fullVersionList に Chromium と Google Chrome の両方が含まれる
    // 検証: Chromium ではない方（Google Chrome）の brand・version が source: "userAgentData" で返る
    expect(pickBrowserBrand(FULL_VERSION_LIST)).toStrictEqual({
      brand: "Google Chrome",
      version: "141.0.7390.54",
      source: "userAgentData",
    });
  });

  it("chromium しかなければ Chromium を選ぶ", () => {
    // 前提: fullVersionList に Chromium と GREASE 値（Not_A Brand）しか無い
    // 検証: Chromium の brand・version が source: "userAgentData" で返る
    expect(
      pickBrowserBrand([
        { brand: "Chromium", version: "141.0.7390.54" },
        { brand: "Not_A Brand", version: "24.0.0.0" },
      ]),
    ).toStrictEqual({ brand: "Chromium", version: "141.0.7390.54", source: "userAgentData" });
  });

  it("意味の無い種類（GREASE）しかなければ null を返す", () => {
    // 前提: fullVersionList に GREASE 値（Not)A;Brand）しか無い
    // 検証: null が返る
    expect(pickBrowserBrand([{ brand: "Not)A;Brand", version: "8.0.0.0" }])).toBeNull();
  });
});

describe("user-Agent からのブラウザの読み取り", () => {
  it("chromium のバージョンだけを読み、OS は含めない", () => {
    // 前提: Chrome を含む User-Agent 文字列
    // 検証: brand: "Chromium"、Chrome のバージョン、source: "userAgent" が返り、OS 等の情報は含まれない
    expect(parseBrowserFromUserAgent(USER_AGENT)).toStrictEqual({
      brand: "Chromium",
      version: "141.0.0.0",
      source: "userAgent",
    });
  });

  it("chrome のバージョンが無ければ null を返す", () => {
    // 前提: Firefox の User-Agent 文字列（Chrome の表記を含まない）
    // 検証: null が返る
    expect(
      parseBrowserFromUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"),
    ).toBeNull();
  });
});

describe("ブラウザの種類とバージョンの読み取り", () => {
  it("user-Agent Client Hints が使えれば、正確なバージョンを読む", async () => {
    // 前提: navigator.userAgentData.getHighEntropyValues が fullVersionList を解決する
    // 検証: fullVersionList から選んだブラウザが返り、["fullVersionList"] で呼ばれている
    const getHighEntropyValues = vi
      .fn<GetHighEntropyValues>()
      .mockResolvedValue({ fullVersionList: FULL_VERSION_LIST });
    await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual({
      brand: "Google Chrome",
      version: "141.0.7390.54",
      source: "userAgentData",
    });
    expect(getHighEntropyValues).toHaveBeenCalledWith(["fullVersionList"]);
  });

  describe("user-Agent Client Hints が使えないときは、User-Agent から読む", () => {
    const fromUserAgent = { brand: "Chromium", version: "141.0.0.0", source: "userAgent" };

    it("navigator.userAgentData が無い", async () => {
      // 前提/検証: userAgentData が無ければ、User-Agent 文字列から読んだブラウザが返る
      await expect(detectBrowser({ userAgent: USER_AGENT })).resolves.toStrictEqual(fromUserAgent);
    });

    it("getHighEntropyValues が失敗する", async () => {
      // 前提/検証: getHighEntropyValues が reject すれば、User-Agent 文字列にフォールバックする
      const getHighEntropyValues = vi
        .fn<GetHighEntropyValues>()
        .mockRejectedValue(new DOMException("許可されていません", "NotAllowedError"));
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });

    it("fullVersionList が返らない", async () => {
      // 前提/検証: fullVersionList を含まない結果なら、User-Agent 文字列にフォールバックする
      const getHighEntropyValues = vi.fn<GetHighEntropyValues>().mockResolvedValue({});
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });

    it("fullVersionList から選べない", async () => {
      // 前提/検証: fullVersionList が空なら、User-Agent 文字列にフォールバックする
      const getHighEntropyValues = vi.fn<GetHighEntropyValues>().mockResolvedValue({ fullVersionList: [] });
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });
  });

  it("どちらからも読めなければ null を返す", async () => {
    // 前提: userAgentData が無く、User-Agent 文字列にも Chrome の表記が無い
    // 検証: null が返る
    await expect(detectBrowser({ userAgent: "Mozilla/5.0 Firefox/140.0" })).resolves.toBeNull();
  });
});

describe("user-Agent Client Hints の型", () => {
  it("typeScript の DOM の型定義に navigator.userAgentData が無い", () => {
    // 前提: 型定義に無いため、browser.ts で使う部分の型（NavigatorLike）を自分で定めている
    // 検証: Navigator 型に userAgentData プロパティが無いこと（型チェックで検証）。
    // このテストが型チェック（pnpm typecheck）で失敗したら、TypeScript の型定義に入ったということなので、自前の型をそちらに置き換える
    expectTypeOf<Navigator>().not.toHaveProperty("userAgentData");
  });
});
