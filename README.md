# Quack Trace

Quack Trace is a browser-based pattern tracing tool for making garment shapes from images, grid paper, or quick sketches.

Illustrator, CLO 3D, Marvelous Designer, apparel CAD tools, PDFs, and hand-drawn references are all useful, but moving pattern ideas back and forth between them can get awkward. Quack Trace is a small practical experiment: a tool for shaping clothing patterns more directly, visually, and playfully.

https://duckthen.github.io/quack-trace/

## 何ができる？

- 画像や方眼紙を下敷きにして、実寸スケールの点・線・カーブを作れます。
- 閉じた図形として服のパーツ形状を作れます。
- 円、カーブ、下書きペン、下書き円を使って、感覚的に形を探れます。
- JSONで作業途中を保存・再読み込みできます。
- SVG / CSV / DXF を書き出せます。
- MD/CLO向け Python、Blender向け Python を書き出せます。
- 実寸確認用に印刷 / PDF保存できます。
- 日本語 / English を切り替えられます。

## 遊んでほしいところ

「面積を保つ」モードをONにすると、面積をなるべく変えずに形を動かせます。

服のパーツは、ちょっと動かしただけで印象が変わります。面積は変えずに輪郭だけ変えると、形の実験がしやすくて面白いです。こっそり作った機能ですが、ぜひ触ってみてください。

## 出力について

作った図は、用途に合わせていくつかの形式に出せます。

- `JSON`: Quack Traceで作業を続けるための保存
- `SVG`: Illustratorなどで確認・編集
- `DXF`: CAD系ツールでの確認用
- `MD/CLO py`: Marvelous Designer / CLO 3D に点や線を作るためのPython出力
- `Blender py`: Blenderで形を確認するためのPython出力
- `印刷 / PDF`: 実寸の黒線図として印刷・PDF保存

出力まわりはまだ実験中です。ツールごとの読み込み差があるので、まずは小さな図形で試すのがおすすめです。

## 大事な注意

タイトル横のイタズラアヒルをクリックすると、アヒルが鳴いて、作図中の点・線・面がリセットされます。

作業中はこまめに `JSON保存` してください。アヒルはかわいいですが、油断すると消します。

## ローカルで試す

リポジトリの親フォルダでサーバーを起動します。

```powershell
python -m http.server 8790 --bind 127.0.0.1
```

ブラウザで開きます。

```text
http://127.0.0.1:8790/quack-trace/
```

`index.html` を直接開いても多くの機能は動きますが、GitHub Pagesに近い状態で見るならローカルサーバーがおすすめです。

## Privacy

Quack Trace runs entirely in the browser as a static HTML/CSS/JavaScript app.

- Loaded images stay in the local browser session.
- The app does not upload images, JSON, or traced coordinates to a server.
- Exported files are created locally by the browser.

GitHub Pages hosts the app files, but it does not receive the images you load into the tool.

See `PRIVACY.md` for the short privacy note.

## Assets

The source code is licensed under the MIT License.

The duck sound effect is a third-party asset from Pixabay and is documented separately in `assets/sounds/README.md`. Do not redistribute or sell the sound as a standalone asset.

## Status

Beta. The app is usable, but the UI and export workflows are still changing.

See `ROADMAP.md` for known improvements and export notes.

Initial public beta notes are drafted in `RELEASE_NOTES.md`.
