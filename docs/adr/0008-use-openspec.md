# 0008. SDD フレームワークとして OpenSpec を使う

- ステータス：Accepted
- 日付：2026-09-29
- 関連 Issue：#7

## コンテキスト

機能の追加・修正は「Issue を起票する → Spec を策定する → 判断を下したら ADR を書く」という流れで進める。Spec は作り始める前に書き（Spec-First）、開発しているあいだは最新に保ち、実装と食い違ったら実装を正として Spec を直す。

この Spec の置き場所と書き方を決める必要がある。AI エージェント（Claude Code・Codex）に Spec を書かせ、Spec に沿って実装させるため、SDD（Spec-Driven Development）のフレームワークを候補にした。

## 検討した選択肢

- **OpenSpec**：現在の振る舞いを表す Spec（`openspec/specs/`）と、変更ごとの差分（`openspec/changes/`）を分けて持ち、完了時に差分を Spec に取り込む。「Spec を最新に保つ」運用にそのまま合う。npm で配布されていて、`devDependencies` で管理できる（ADR 0005）。一方、変更ごとの proposal・tasks の内容が Issue と重なる
- **Spec Kit**：利用者が最も多い。一方、Python と uv が必要で、Nix devShell に追加しなければならない。ブランチ名 `NNN-feature` を自動で作るため、`<type>/<Issue番号>-<説明>` の規約（ADR 0007）と合わない。機能ごとのフォルダはスナップショットになりやすく、constitution の内容が AGENTS.md と重なる
- **cc-sdd**：日本語に対応している。一方、機能ごとに要件・設計・タスクの3段階を踏むため重く、steering の内容が AGENTS.md と重なる
- **導入しない（`docs/specs/` を手で書く）**：最も軽い。一方、Spec の書式と差分の取り込み方を自分で決めて守る必要がある

## 決定

OpenSpec を使う。

- `@fission-ai/openspec` を `devDependencies` に追加し、`openspec init --tools claude,codex --profile core` で Claude Code・Codex 向けのスキル・コマンドを生成する
- 生成されたスキルは `openspec` コマンドを直接呼ぶため、devShell で `node_modules/.bin` を `PATH` に通す
- テレメトリと npm への更新確認は `OPENSPEC_TELEMETRY=0` で無効にする。更新は Renovate の PR で行う
- 生成物は `openspec update` で上書きされるため、treefmt の対象から外し、手で編集しない
- Spec の本文は日本語で書く。OpenSpec が解析する見出し・キーワードは英語のままにし、要件の本文には `SHALL` か `MUST` を含める（`openspec/config.yaml` の `context`）
- Issue との重なりは、背景と受入条件を Issue に書き、proposal から Issue 番号を参照して解消する

## 結果

- Spec が `openspec/specs/` に集まり、変更の差分がレビューできるようになる
- OpenSpec を更新したら `openspec update` で生成物を作り直し、差分をコミットする必要がある
- `node_modules/.bin` が `PATH` に入るため、devShell 内では他の JS ツール（oxlint 等）も `pnpm exec` なしで呼べる
- 一人での開発では、SDD フレームワークは手間とトークンの消費が見合わない可能性がある。重いと感じたら、この ADR を置き換えて取りやめる
