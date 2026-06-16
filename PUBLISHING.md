# Publishing Quack Trace

This file is a short release checklist for publishing Quack Trace to GitHub and GitHub Pages.

## 1. Create the GitHub Repository

Create a new public repository:

```text
https://github.com/DUCKTHEN/quack-trace
```

Recommended settings:

- Repository name: `quack-trace`
- Visibility: `Public`
- Do not add a README, LICENSE, or `.gitignore` on GitHub. They already exist locally.

## 2. Push Local Git

From the local repository folder:

```powershell
git push -u origin main
```

If the remote was not configured yet:

```powershell
git remote add origin https://github.com/DUCKTHEN/quack-trace.git
git push -u origin main
```

## 3. Enable GitHub Pages

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/ (root)`.
6. Save.

The site should become available at:

```text
https://duckthen.github.io/quack-trace/
```

## 4. Before Sharing Publicly

- Open the GitHub Pages URL on desktop.
- Open the GitHub Pages URL on mobile.
- Confirm image loading stays local.
- Confirm JSON import/export works.
- Confirm the duck sound plays only after user interaction.
- Confirm `assets/sounds/README.md` is present for the Pixabay sound note.
- Confirm no local screenshots, Obsidian notes, personal paths, or test archives were committed.

## 5. Create A Beta Release

Suggested tag:

```powershell
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

Then create a GitHub Release from that tag and paste the contents of `RELEASE_NOTES.md`.

## 6. Known Beta Notes

- Mobile layout still needs polish.
- Export workflows are useful but still experimental.
- MD/CLO and Blender scripts are experiments, not guaranteed production importers.
