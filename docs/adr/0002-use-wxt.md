# 0002. 拡張機能のフレームワークに WXT を採用する

- ステータス：Accepted
- 日付：2026-09-28

## コンテキスト

TabHerd は、タブグループを自動で管理する Chrome 拡張機能（Manifest V3）である。主な処理は、`chrome.tabs`・`chrome.tabGroups` を使う service worker、ルールの保存、設定画面で、content script はほとんど使わない。

## 検討した選択肢

- **WXT**：Vite をベースにしたフレームワーク。`entrypoints/` のファイル構成から `manifest.json` を生成し、ストレージ・メッセージング・ストア提出用の zip 作成などを備える。Chrome 以外のブラウザにも対応する。v1.0 前のため破壊的変更がありうる
- **CRXJS**：Vite のプラグイン。Vite の設定を自分で管理でき、content script のホットリロードが速い。一方、備わっている機能が少なく、実質 Chrome・Edge のみの対応で、2025〜2026年は更新が減っている
- **Plasmo**：Parcel ベースで、Vite 系よりビルドが遅い
- **Vite+**：Vite・Vitest・Oxlint・Oxfmt などをまとめたツールチェーン。検討時点（2026年9月）では v1.0 の RC が出たばかりだった。WXT は独自の CLI で Vite を動かすため、`vp dev` / `vp build` とは役割が重なる。また、`vp env` による Node.js の管理が、Nix devShell での管理と重なる

## 決定

WXT を採用する。TabHerd では WXT のストレージや設定画面のエントリポイントをそのまま使える。一方、CRXJS の強みである content script のホットリロードはほとんど使わない。Vite+ は採用しない。

## 結果

- manifest の生成、ストア提出用の zip 作成、Chrome 以外への対応を WXT に任せられる
- WXT が v1.0 になるまでは、更新時に破壊的変更がないかを確認する必要がある
- Vite+ が 1.0 正式版になり、WXT との組み合わせが確認できたら、lint・整形・テストをまとめるか改めて検討できる
