# Proposal

## Why

`utils/`・`components/`・`entrypoints/` には自由形式の `/** ... */` コメントはあるが、`@param`・`@returns`・`@remarks` 等の構造化された TSDoc タグを使っていない。テストコードにも、各 `it`/`test` 単位での前提・検証項目のコメントが無い。構造化された規約が無いまま既存コードが増えると、後から規約を導入したときの遡及コストがさらに大きくなる。Issue #78 でこの規約を導入し、既存コードへ遡及適用することが決まっている。

## What Changes

- `.claude/rules/typescript.md` に、TSDoc は `@param`・`@returns`・`@remarks` 等の構造化タグを使う規約と、テストの `it`/`test` 単位で前提条件・事前条件・検証項目をコメントとして書く規約を追記する
- `utils/`・`components/`・`entrypoints/` のエクスポートされた型・関数・コンポーネントに構造化 TSDoc タグを付与する（既存の自由形式コメントを構造化タグに改める）
- 全テストファイルの各 `it`/`test` に、前提条件・事前条件・検証項目のコメントを付与する（`describe` 単位でまとめない）
- 規約の採用を ADR として `docs/adr/` に記録する

このコミットは #77（タブグループの手動サスペンド機能）とは別の Issue・PR に分ける。

## Capabilities

### New Capabilities

なし

### Modified Capabilities

なし（アプリケーションの外部から観測できる振る舞いは変わらない。コメント・ドキュメント規約のみの変更のため `skip_specs: true` とする）

## Impact

- 影響するコード: `utils/`・`components/`・`entrypoints/` 配下のエクスポートされた型・関数・コンポーネントのコメント、全テストファイルの `it`/`test` 本体（ロジックは変更しない）
- 影響するドキュメント: `.claude/rules/typescript.md`、`docs/adr/`
- 依存・ビルド・API への影響: なし
