# Quack Trace v0.1.0-beta

First public beta release of Quack Trace.

Quack Trace is a browser-based pattern tracing tool for collecting real-size coordinates from images. It is designed for sewing-pattern drafting tests, image tracing, coordinate capture, and export experiments.

## Highlights

- Static browser app: no backend server required.
- Runs locally in the browser.
- Loaded images are not uploaded by the app.
- Real-size scale calibration from a known length.
- Point, line, curve, and closed-shape tracing.
- Built-in grid paper.
- Grid snap toggle.
- Configurable arrow-key nudging.
- JSON import/export for saving work-in-progress.
- SVG export for Illustrator testing.
- CSV, DXF, MD/CLO Python, and Blender Python export experiments.
- Japanese and English UI toggle.
- Duck click sound with documented asset license notes.

## GitHub Pages

Expected Pages URL:

```text
https://duckthen.github.io/quack-trace/
```

## Known Beta Limits

- Mobile layout needs more polish.
- Some export paths are experimental.
- MD/CLO and Blender Python exports are not guaranteed production importers.
- Editing workflows around deleting points from closed shapes still need careful testing.
- Adding points into existing shapes is planned but not complete.

## Safety And License Notes

- Source code: MIT License.
- Duck sound: Pixabay Content License, documented in `assets/sounds/README.md`.
- Do not redistribute or sell the bundled duck sound as a standalone sound asset.
- The app does not intentionally upload user images or traced data.

## Suggested Git Tag

```powershell
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

