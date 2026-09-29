import { configDefaults, defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // nix-direnv が .direnv/ に置く flake の入力（nixpkgs のソース等）のテストを拾わないようにする
    exclude: [...configDefaults.exclude, ".direnv/**"],
  },
});
