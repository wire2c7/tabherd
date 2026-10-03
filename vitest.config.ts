import { configDefaults, defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // nix-direnv が .direnv/ に置く flake の入力（nixpkgs のソース等）のテストを拾わないようにする
    exclude: [
      ...configDefaults.exclude,
      ".direnv/**",
      // E2E のテストは Playwright で実行する（ファイル名は *.e2e.ts で既定の対象と重ならないが、設定ファイル等を拾わないよう除く）
      "e2e/**",
    ],
    // vi.spyOn のモックを各テストの前に戻す。前のテストが途中で失敗しても、そのモックが後のテストに残らない
    restoreMocks: true,
  },
});
