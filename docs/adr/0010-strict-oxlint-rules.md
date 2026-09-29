# 0010. Oxlint のルールを厳しくし、型情報を使う lint を導入する

- ステータス：Accepted
- 日付：2026-09-29
- 関連 Issue：#11

## コンテキスト

Oxlint は設定ファイルを置かず、デフォルトのルール（correctness カテゴリ）だけで動かしていた。本格的な実装に入る前に、バグにつながる書き方・パフォーマンスを落とす書き方を検出し、コーディングスタイルを揃えたい。

拡張機能のコードは `browser.*` の API を多く呼び、その大半が Promise を返す。await し忘れると、エラーが握りつぶされたり処理の順序が崩れたりするが、TypeScript の型チェックでは検出できない。

## 検討した選択肢

### ルールの選び方

- **必要なルールを1つずつ有効にする（許可リスト）**：意図しない指摘は出ない。一方、Oxlint のルールが増えても取り込まれず、厳しさがルールを選んだ人の知識に左右される
- **カテゴリ単位で有効にし、合わないルールだけを無効にする（拒否リスト）**：Oxlint の更新で追加されたルールも自動で検査に加わる。更新時に新しい違反が出ることがある
- **すべてのカテゴリ（`all`）を有効にする**：restriction カテゴリには `no-optional-chaining`・`no-async-await` のように言語機能そのものを禁じるルールが含まれ、互いに矛盾するものも多い

### 型情報を使う lint

- **`oxlint-tsgolint` を導入する**：`no-floating-promises`・`no-misused-promises`・`strict-boolean-expressions` 等を使える。typescript-go をもとにしており、TypeScript 7 の `tsconfig` をそのまま読める。一方、devDependencies が1つ増え、lint が型の解析の分だけ遅くなる
- **導入しない**：依存は増えないが、Promise の扱いの誤りを検出できない

## 決定

- correctness・suspicious・pedantic・perf・style のカテゴリをエラーで有効にする（拒否リスト）。restriction は、言語機能を禁じるものを除き、ルールを個別に選んで有効にする。nursery は開発中のため有効にしない
- 次のルールは、理由を `.oxlintrc.jsonc` のコメントに残したうえで無効にする。どれにも当てはまらないルールは無効にしない
  - 役割が重なるルール（同じ内容を検査するルールが別のプラグインにもある）：片方だけを残す
  - 互いに矛盾するルール（例：`import/prefer-default-export` と `import/no-named-export`）：片方を無効にする
  - 整形に関わり、Oxfmt と役割が重なるルール：Oxfmt に任せる
  - このプロジェクトに合わないルール（例：日本語のコメントに対する `capitalized-comments`、DOM・Preact の API に対する `unicorn/no-null`）
- プラグインは、デフォルトの eslint・typescript・unicorn・oxc に、import・promise・react・react-perf・jsx-a11y を加える。vitest はテストファイルだけで有効にする。React 向けのルールは、JSX の書き方と hooks の規則が共通するため、Preact にも使う
- `react-perf` のルールは、DOM 要素に渡す props を対象から外し、コンポーネントに渡す props だけを検出する。Preact は DOM 要素のイベントハンドラーを差し替えてもリスナーを再登録しないため、DOM 要素にインラインの関数を渡しても再描画は増えない
- default export は、WXT が必須とするエントリポイントと設定ファイルだけに許し、それ以外は named export に揃える
- `oxlint-tsgolint` を導入し、`.oxlintrc.jsonc` の `options.typeAware` で型情報を使う lint を有効にする。CLI 引数（`--type-aware`）ではなく設定ファイルに書くことで、`pnpm lint` と prek のフックで引数を揃えずに済む

## 結果

- Promise の await 忘れ・`for…of` にすべきループ・`Promise.all` にできる直列の await 等を、コミット時と CI で検出できる
- 既存コードも、戻り値の型の明記（`explicit-module-boundary-types`）・`querySelector` への統一等に合わせて直した
- Oxlint・`oxlint-tsgolint` の更新で新しいルールが加わると、更新 PR で違反が出ることがある。そのときは、コードを直すか、理由を添えてルールを無効にする
- `import` 文の並び順は検査しない（`eslint/sort-imports` は1文の中の名前の順だけを検査する）。並べ替えを自動化するなら、Oxfmt の import の並べ替えを別途検討する
