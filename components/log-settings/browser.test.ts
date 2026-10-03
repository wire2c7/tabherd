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
    expect(pickBrowserBrand(FULL_VERSION_LIST)).toStrictEqual({
      brand: "Google Chrome",
      version: "141.0.7390.54",
      source: "userAgentData",
    });
  });

  it("chromium しかなければ Chromium を選ぶ", () => {
    expect(
      pickBrowserBrand([
        { brand: "Chromium", version: "141.0.7390.54" },
        { brand: "Not_A Brand", version: "24.0.0.0" },
      ]),
    ).toStrictEqual({ brand: "Chromium", version: "141.0.7390.54", source: "userAgentData" });
  });

  it("意味の無い種類（GREASE）しかなければ null を返す", () => {
    expect(pickBrowserBrand([{ brand: "Not)A;Brand", version: "8.0.0.0" }])).toBeNull();
  });
});

describe("user-Agent からのブラウザの読み取り", () => {
  it("chromium のバージョンだけを読み、OS は含めない", () => {
    expect(parseBrowserFromUserAgent(USER_AGENT)).toStrictEqual({
      brand: "Chromium",
      version: "141.0.0.0",
      source: "userAgent",
    });
  });

  it("chrome のバージョンが無ければ null を返す", () => {
    expect(
      parseBrowserFromUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"),
    ).toBeNull();
  });
});

describe("ブラウザの種類とバージョンの読み取り", () => {
  it("user-Agent Client Hints が使えれば、正確なバージョンを読む", async () => {
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
      await expect(detectBrowser({ userAgent: USER_AGENT })).resolves.toStrictEqual(fromUserAgent);
    });

    it("getHighEntropyValues が失敗する", async () => {
      const getHighEntropyValues = vi
        .fn<GetHighEntropyValues>()
        .mockRejectedValue(new DOMException("許可されていません", "NotAllowedError"));
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });

    it("fullVersionList が返らない", async () => {
      const getHighEntropyValues = vi.fn<GetHighEntropyValues>().mockResolvedValue({});
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });

    it("fullVersionList から選べない", async () => {
      const getHighEntropyValues = vi.fn<GetHighEntropyValues>().mockResolvedValue({ fullVersionList: [] });
      await expect(detectBrowser(withUserAgentData(getHighEntropyValues))).resolves.toStrictEqual(fromUserAgent);
    });
  });

  it("どちらからも読めなければ null を返す", async () => {
    await expect(detectBrowser({ userAgent: "Mozilla/5.0 Firefox/140.0" })).resolves.toBeNull();
  });
});

describe("user-Agent Client Hints の型", () => {
  it("typeScript の DOM の型定義に navigator.userAgentData が無い", () => {
    // 型定義に無いため、browser.ts で使う部分の型（NavigatorLike）を自分で定めている。
    // このテストが型チェック（pnpm typecheck）で失敗したら、TypeScript の型定義に入ったということなので、自前の型をそちらに置き換える
    expectTypeOf<Navigator>().not.toHaveProperty("userAgentData");
  });
});
