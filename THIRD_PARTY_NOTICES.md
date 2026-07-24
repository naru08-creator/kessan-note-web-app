# サードパーティ ライセンス表記

このアプリ自体のコード（`core/kessan-core.js` など、えるぴょんが書いた部分）はLICENSE（MIT）に従います。
ただし画面の表示・動作のために、以下のライブラリをCDN経由で読み込んで使用しています。
これらはリポジトリに同梱しているわけではなく、実行時にそれぞれの配布元から読み込まれます。

| ライブラリ | ライセンス | 用途 |
|---|---|---|
| [React](https://react.dev/) / [React DOM](https://react.dev/) | MIT License (Meta Platforms, Inc.) | 画面全体のUI構築 |
| [Recharts](https://recharts.org/) | MIT License | グラフ描画（棒グラフ・折れ線グラフなど） |
| [Babel Standalone](https://babeljs.io/) | MIT License | ブラウザ上でのJSXの変換（ビルド不要にするため） |
| [JSZip](https://stuk.github.io/jszip/) | MIT License / GPLv3（デュアルライセンス、どちらか選んで利用可） | CSVバックアップのzip生成・読み込み |
| [Electron](https://www.electronjs.org/) | MIT License | Electron版のみ：デスクトップアプリ化 |

フォントも以下を使用しています（Google Fonts経由）。

| フォント | ライセンス |
|---|---|
| Zen Old Mincho / Zen Kaku Gothic New | SIL Open Font License 1.1 |
| JetBrains Mono | Apache License 2.0 |

各ライブラリ・フォントの著作権は、それぞれの制作者・団体に帰属します。
