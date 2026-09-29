import { defineConfig } from "@playwright/test";

// Chromium は E2E の devShell（`nix develop .#e2e`）が渡す。devShell の外では最初に止め、実行の仕方を示す
if ((process.env["TABHERD_E2E_CHROMIUM"] ?? "") === "") {
  throw new Error(
    "TABHERD_E2E_CHROMIUM がありません。E2E テストは `nix develop .#e2e --command pnpm e2e` で実行してください",
  );
}

const isCi = (process.env["CI"] ?? "") !== "";

export default defineConfig({
  // Vitest の対象（*.test.ts・*.spec.ts）と重ならないよう、E2E のテストは *.e2e.ts にする
  testMatch: "*.e2e.ts",
  // テストごとに別の Chromium を起動するため、ファイルの中のテストも並列にしてよい
  fullyParallel: true,
  forbidOnly: isCi,
  // CI では失敗したテストのレポートとトレースを artifact に残す
  reporter: isCi ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
  },
});
