# Proposal

## Why

manifest に対応する最低の Chrome バージョンが無く、コードは宣言の無いまま `tabGroups`（Chrome 89）・`toSorted`（110）・`color-mix()`（111）・`Promise.withResolvers`（119、#53）を前提にしている。宣言より古い Chrome では一部の操作が失敗するため、最低版を決めて manifest に書く（#54）。

## What Changes

- `wxt.config.ts` の manifest に `minimum_chrome_version: "140"` を書く
- 最低版の決め方と上げ方を ADR に残す
- 使う API を最低版で使えるものに限ることを規約（`AGENTS.md`）に書く

## Capabilities

### New Capabilities

なし（manifest の宣言で、拡張機能の機能は変わらない）

### Modified Capabilities

なし

## Impact

- `wxt.config.ts`: manifest に `minimum_chrome_version` を加える。Chrome 140 より古い Chrome では、Chrome ウェブストアから入れられず、更新も届かなくなる
- `docs/adr/`: 最低の Chrome バージョンについての ADR
- `AGENTS.md`: 規約に、使う API を最低版で使えるものに限ることを加える
