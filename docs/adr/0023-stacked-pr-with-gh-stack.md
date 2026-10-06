# 0023. Stacked PR の管理を gh-stack に移行する

- ステータス：Accepted
- 日付：2026-10-06
- 関連 Issue：#75

## コンテキスト

ADR 0009 では、Stacked PR（前の PR のブランチを起点にした PR）の宛先を `develop` に固定することにした。`Closes #N` は `develop`（デフォルトブランチ）へのマージでしか効かないため、すべての PR で Issue を自動的に閉じられるようにする狙いだった。

一方でこの決定には、前の PR がマージされるまで差分に前の PR の変更が含まれて見える、マージ順を自分で意識する必要がある、という負担がある。

使い捨てのリポジトリで、GitHub ネイティブの Stacked PRs 機能（CLI 拡張 `gh extension install github/gh-stack`。nixpkgs に `gh-stack` としてパッケージ済み）を検証した。トランク `main`、`layer1-branch`（PR、`Closes #1`）、`layer2-branch`（`layer1-branch` を宛先にした PR、`Closes #2`）というスタックを作り、`gh stack merge` で下位 PR から順にマージしたところ、次の結果が確認できた。

- 下位 PR がマージされると、スタックの中で未マージの最下層にある PR のベースブランチが、次の層のブランチではなく **トランク（`main`/本リポジトリでは `develop`）まで自動で retarget される**
- そのため、`gh stack merge` でスタックを順にマージしていけば、各層の `Closes #N` が引き続き機能する（すべての Issue が自動的にクローズされた）
- `gh pr merge` の通常操作はスタック化された PR には使えず、`gh stack merge`（非同期マージ API 経由）が必須
- マージ方法は `--merge`（マージコミット）を指定でき、本リポジトリの「マージはマージコミットのみ」という方針（マージ・リベースはリポジトリ設定で無効）と両立する

## 検討した選択肢

- **ADR 0009 のまま（宛先を `develop` に固定、手動でブランチ・PR を管理）**：追加のツール導入は不要。一方、マージ順を自分で意識する負担、差分が大きく見える問題は解消されない
- **`gh-stack` に移行する**：ブランチの作成・プッシュ・PR 作成・リベースの追従・マージ順の制御を `gh stack` コマンドに任せられる。`Closes #N` の挙動は検証の結果、全層で維持される。導入コストとして devShell へのツール追加が要る

## 決定

Stacked PR の作成・管理に `gh-stack`（`gh extension install github/gh-stack` 相当。本リポジトリでは nixpkgs の `gh-stack` を Nix devShell に追加して提供）を使う。

- スタックのトランクは `develop` にする（`gh stack init --base develop`）
- スタック内の各 PR のベースブランチは、`gh-stack` が設定する「1つ下のブランチ」のままにする（ADR 0009 のように `develop` へ強制しない）。下位 PR のマージ時に GitHub が自動で retarget するため、`Closes #N` は引き続き機能する
- マージは `gh stack merge --merge` を使う（マージコミットのみという方針に合わせる）
- 子 Issue（Sub-issue）による作業の分割方針（ADR 0009）は変更しない。`gh-stack` は分割した子 Issue のブランチ・PR 同士の依存関係を管理する手段として併用する

ADR 0009 の「Stacked PR の宛先」の決定は、本 ADR によって置き換える（`Superseded by 0023`）。

## 結果

- マージ順の管理・ベースブランチの追従・PR 作成が `gh stack` コマンドに代わり、手動での意識が減る
- `gh pr merge` ではなく `gh stack merge` を使う必要がある、という操作上の制約が増える
- devShell に `gh-stack` を追加した（`flake.nix`）。`gh` 本体は本リポジトリの devShell では管理しておらず、各自の環境にあるものを使う前提は変わらない
- GitHub ネイティブの Stacked PRs 機能は本 ADR の判断時点で Public Preview であり、挙動が今後変わる可能性がある
