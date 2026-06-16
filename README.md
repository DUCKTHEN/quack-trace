# Quack Trace

Quack Trace is a browser-based pattern tracing tool for collecting real-size coordinates from images.

It is currently a beta tool for drafting and testing sewing-pattern workflows. Load an image, set a real-world scale, place points along outlines, bend edges into curves, close shapes, and export the traced data.

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

## Privacy

Quack Trace runs entirely in the browser as a static HTML/CSS/JavaScript app.

- Loaded images stay in the local browser session.
- The app does not upload images, JSON, or traced coordinates to a server.
- Exported files are created locally by the browser.

GitHub Pages hosts the app files, but it does not receive the images you load into the tool.

See `PRIVACY.md` for the short privacy note.

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

## Status

Beta. The app is usable, but the UI and export workflows are still changing.

See `ROADMAP.md` for known improvements and export notes.

Initial public beta notes are drafted in `RELEASE_NOTES.md`.
