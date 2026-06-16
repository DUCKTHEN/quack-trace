# Quack Trace

Quack Trace is a browser-based pattern tracing tool for collecting real-size coordinates from images.

It is currently a beta tool for drafting and testing sewing-pattern workflows. Load an image, set a real-world scale, place points along outlines, bend edges into curves, close shapes, and export the traced data.

## 日本語概要

Quack Trace は、画像を下敷きにして実寸座標を取るためのブラウザ製図トレースツールです。

画像を読み込み、既知の長さからスケールを設定し、輪郭上に点を置いて線やカーブを作れます。閉じた図形、JSON保存、SVG/CSV/DXF/Python系の実験的な書き出しにも対応しています。

現在はベータ版です。基本的なトレース作業には使えますが、UIや書き出し機能は今後も調整していきます。

## Features

- Image underlay loading in the browser
- Built-in grid paper for quick real-size tracing
- Scale calibration from a known length
- Point, line, curve, and closed-shape editing
- Undo / redo
- Keyboard nudging with configurable distance
- Grid snap toggle
- JSON import / export for work-in-progress saves
- SVG, CSV, DXF, MD/CLO Python, and Blender Python export experiments
- Japanese / English UI toggle

## 主な機能

- ブラウザ内で画像を下敷きとして読み込み
- 方眼紙表示とグリッドスナップ
- 既知の長さによるスケール設定
- 点、線、カーブ、閉じた図形の編集
- Undo / Redo
- 方向キーによる指定距離移動
- 作業途中保存用の JSON 読み込み / 書き出し
- SVG、CSV、DXF、MD/CLO Python、Blender Python の実験的な書き出し
- 日本語 / 英語 UI 切り替え

## Privacy

Quack Trace runs entirely in the browser as a static HTML/CSS/JavaScript app.

- Loaded images stay in the local browser session.
- The app does not upload images, JSON, or traced coordinates to a server.
- Exported files are created locally by the browser.

GitHub Pages hosts the app files, but it does not receive the images you load into the tool.

See `PRIVACY.md` for the short privacy note.

## プライバシー

Quack Trace は静的な HTML/CSS/JavaScript アプリとしてブラウザ内で動きます。

- 読み込んだ画像はローカルのブラウザセッション内に残ります。
- アプリは画像、JSON、トレース座標をサーバーへアップロードしません。
- 書き出しファイルはブラウザ上でローカルに作成されます。

GitHub Pages はアプリ本体を配信しますが、ユーザーが読み込んだ画像を受け取りません。

## Try Locally

From the repository parent folder:

```powershell
python -m http.server 8790 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8790/quack-trace/
```

You can also open `index.html` directly in a browser for most workflows, but using a local server is closer to the GitHub Pages environment.

## ローカルで試す

リポジトリの親フォルダから:

```powershell
python -m http.server 8790 --bind 127.0.0.1
```

ブラウザで開きます:

```text
http://127.0.0.1:8790/quack-trace/
```

## GitHub Pages

This app is designed to be published from the repository root with GitHub Pages:

1. Push this folder to a GitHub repository, for example `DUCKTHEN/quack-trace`.
2. In GitHub, open `Settings > Pages`.
3. Set `Build and deployment` to `Deploy from a branch`.
4. Select the `main` branch and `/ (root)`.
5. The public app URL will be similar to:

```text
https://duckthen.github.io/quack-trace/
```

## Asset Notes

The source code is licensed under the MIT License.

The duck sound effect is a third-party asset from Pixabay and is documented separately in `assets/sounds/README.md`. Do not redistribute or sell the sound as a standalone asset.

## ライセンスと素材

ソースコードは MIT License です。

アヒルの効果音は Pixabay 由来の第三者素材で、詳細は `assets/sounds/README.md` に記録しています。音声素材単体として再配布・販売しないでください。

## Status

Beta. The app is usable, but the UI and export workflows are still changing.

See `ROADMAP.md` for known improvements and export notes.

Initial public beta notes are drafted in `RELEASE_NOTES.md`.

## 開発状況

現在はベータ版です。基本機能は動作しますが、スマホ表示、図形編集、各種エクスポートは今後も改善予定です。
