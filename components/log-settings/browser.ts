/** 書き出すログに添えるブラウザの種類とバージョン */
export interface BrowserInfo {
  /** ブラウザの種類（Google Chrome、Microsoft Edge 等）。User-Agent から読んだときは Chromium */
  brand: string;
  version: string;
  /**
   * どこから読んだか。userAgent は簡略化された User-Agent（例: 141.0.0.0）で、バージョンの細かい部分と
   * Chromium を基にしたブラウザの種類（Edge 等）が分からない
   */
  source: "userAgentData" | "userAgent";
}

/** User-Agent Client Hints（navigator.userAgentData）のうち、使う部分。TypeScript の DOM の型定義に無いため、ここで定める */
interface UserAgentDataLike {
  getHighEntropyValues: (hints: string[]) => Promise<{ fullVersionList?: readonly BrandVersion[] }>;
}

interface BrandVersion {
  brand: string;
  version: string;
}

/** ブラウザの情報を読む navigator のうち、使う部分 */
export interface NavigatorLike {
  userAgent: string;
  userAgentData?: UserAgentDataLike;
}

/** ブラウザの種類の一覧に混ぜられる、意味の無い種類（GREASE。例: "Not)A;Brand"） */
const GREASE_BRAND = /not.?a.?brand/iu;

/**
 * fullVersionList からブラウザの種類とバージョンを選ぶ。Chromium を基にしたブラウザは Chromium と自身の種類の両方を返すため、
 * Chromium 以外があればそちらを選ぶ。選べなければ null
 */
export function pickBrowserBrand(fullVersionList: readonly BrandVersion[]): BrowserInfo | null {
  const brands = fullVersionList.filter(({ brand }) => !GREASE_BRAND.test(brand));
  const picked = brands.find(({ brand }) => brand !== "Chromium") ?? brands[0];
  return picked === undefined ? null : { brand: picked.brand, version: picked.version, source: "userAgentData" };
}

/** User-Agent から Chromium のバージョンを読む。User-Agent の全体は OS も含むため、バージョンだけを返す。読めなければ null */
export function parseBrowserFromUserAgent(userAgent: string): BrowserInfo | null {
  const version = /\bChrome\/(?<version>[\d.]+)/u.exec(userAgent)?.groups?.["version"];
  return version === undefined ? null : { brand: "Chromium", version, source: "userAgent" };
}

/**
 * ブラウザの種類とバージョンを読む。User-Agent Client Hints の fullVersionList を使い、
 * 使えない（API が無い、失敗する、一覧が無い・空）ときは User-Agent から読む
 */
export async function detectBrowser(navigatorLike: NavigatorLike): Promise<BrowserInfo | null> {
  try {
    const values = await navigatorLike.userAgentData?.getHighEntropyValues(["fullVersionList"]);
    const picked = values?.fullVersionList === undefined ? null : pickBrowserBrand(values.fullVersionList);
    if (picked !== null) {
      return picked;
    }
  } catch {
    // User-Agent から読む
  }
  return parseBrowserFromUserAgent(navigatorLike.userAgent);
}
