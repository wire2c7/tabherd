# 0006. pnpm のサプライチェーン対策とバージョン固定

- ステータス：Accepted
- 日付：2026-09-28

## コンテキスト

npm のエコシステムでは、メンテナのアカウントが乗っ取られ、悪意のあるバージョンが公開される事件が続いている。拡張機能はユーザーのブラウザで動くため、依存パッケージからの侵入は影響が大きい。

pnpm 12 では、次の設定が既定値ですでに安全側になっている。

- `strictDepBuilds: true`（依存のビルドスクリプトは承認制）
- `blockExoticSubdeps: true`（間接依存で git や tarball から取得することを禁止）
- `minimumReleaseAge: 1440`（公開から1日たったバージョンのみ）

## 検討した選択肢

### 公開からの待ち時間（`minimumReleaseAge`）

- **1日（既定値）**：新しいバージョンをすぐ使える
- **3日**：乗っ取りが発覚して取り下げられるまでの時間を取れる。Renovate にも同じ3日のプリセット（`security:minimumReleaseAgeNpm`）がある
- **7日**：より安全だが、セキュリティ修正の取り込みも遅れる

pnpm と Renovate の待ち時間がずれると、Renovate の更新 PR が pnpm の検査で失敗する。

### 公開元の信頼レベル（`trustPolicy`）

`no-downgrade` にすると、Trusted Publishing や provenance（ビルド元の証明）の有無が以前のバージョンより下がったときに失敗させられる。一方で誤検知もある。導入時には `why-is-node-running@3.2.2`（vitest の依存）が検出されたが、3.2.0・3.2.1 と同じメンテナが provenance を付けずに公開しただけで、乗っ取りではなかった。

### バージョンの指定

- **範囲指定（`^`）**：`pnpm-lock.yaml` で固定されるため、通常のインストールでは問題ない
- **完全一致**：`package.json` を見るだけで使っているバージョンが分かり、更新が必ず Renovate の PR を通る

## 決定

`pnpm-workspace.yaml` に、既定値と異なる次の設定を書く。

- `minimumReleaseAge: 4320`（3日）とし、Renovate も `security:minimumReleaseAgeNpm` で揃える
- `trustPolicy: no-downgrade` とする。誤検知と確認できたものだけ、バージョンを限定して `trustPolicyExclude` に加える
- `engineStrict: true` とし、依存の engines が合わない場合はインストールを失敗させる
- `savePrefix: ""` としてバージョンを完全一致で固定し、Renovate も `:pinAllExceptPeerDependencies` で固定したまま更新する

## 結果

- 公開から3日未満のバージョンは入らない（`ERR_PNPM_NO_MATURE_MATCHING_VERSION`）。緊急のセキュリティ修正も3日待つことになる
- `trustPolicy` の違反が出たら、公開者と provenance の履歴を調べる手間がかかる
- Renovate の lock file maintenance は、pnpm 自身が待ち時間を検査するため、Renovate 側の待ち時間の対象外になっている
