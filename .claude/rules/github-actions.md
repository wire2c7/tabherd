---
paths:
  - ".github/workflows/*.yml"
  - ".github/workflows/*.yaml"
---

# GitHub Actions規約

## 主な規約（actionlint では検出されない観点）

- `uses:` はコミットハッシュで固定し、コメントにバージョンを残す（`uses: owner/repo@<commit-hash> # vX.Y.Z`）。ハッシュの更新は Renovate に任せる
- `permissions` はワークフロー単位で最小限にし、書き込み権限が必要なジョブだけに付与する
- `actions/checkout` は、後続のステップで push しない限り `persist-credentials: false` にする
- `${{ }}` で展開する値（特に PR タイトル・ブランチ名等の外部入力）は `run:` に直接埋め込まず、`env:` 経由で渡す
- ツールは `nix develop --command` 経由で実行し、ローカルの devShell とバージョンを揃える（セットアップ用の Action でツールを別途インストールしない）

## 自動チェック

- lint: `actionlint`（`prek`）
