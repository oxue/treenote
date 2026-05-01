# Self-Contained HTML Export — Design Spec

> **Status**: design only, not implemented. Issue #61.

## Overview

Let the user pick any node in their tree and export the subtree rooted at it as a **single self-contained `.html` file** — one file, no server, no Supabase, no build step. Open the file in any browser and it behaves like a read-only, navigable mini-treenote: same look, same arrow-key navigation, same expand/collapse, same markdown/image rendering. Drop it in a Slack DM, attach it to an email, host it on a static page — it just works.

The export is a **read-only snapshot**. No editing, no save, no auth, no network calls. If the original tree changes later, you re-export.

---

## User Experience

### Trigger
Two equivalent triggers:

1. **Keybinding**: `Cmd+Shift+E` (or `Ctrl+Shift+E`) in visual mode. Exports the **selected node** (the current cursor in the graph) and its full subtree.
2. **Settings panel**: a new "Export" tab in `WebSettingsPanel.jsx` with a single "Export current node as HTML" button. Useful for discoverability and for users who don't memorize keys.

We deliberately do **not** add a top-bar button. Treenote's UI is keyboard-first and visually minimal — issue #61 explicitly calls out "without cluttering things". The keybinding is the primary path; the settings tab is the discovery path.

### Flow

1. User selects a node in the graph (normal navigation).
2. User hits `Cmd+Shift+E`.
3. A small toast appears: "Exporting…"
4. Browser triggers a download: `treenote-<root-text-slug>-<YYYYMMDD>.html` (e.g. `treenote-grocery-list-20260501.html`).
5. Toast updates: "Exported ✓".

No modal, no confirmation, no options dialog on the first version. If we later need format options (include checked items? expand all?), they can live in the settings tab.

### What the recipient sees

When someone opens the exported `.html` file:

- Same dark/light theme the exporter was using (theme is baked in).
- Same three-column layout (parent / current / children) on desktop, same single-column stack on mobile.
- Arrow keys / `hjkl` navigate exactly as in the live app.
- Markdown nodes render as markdown. Image nodes render the embedded image.
- Deadlines, priorities, checked state — all visible.
- A small banner at the top: "Read-only snapshot · Exported from Treenote · 2026-05-01 · [treenote.app]". The banner is dismissable.
- **No** edit affordances. Pressing edit keys (Enter, `i`, etc.) does nothing or shows a tiny "read-only" toast.
- **No** queue, no settings panel, no auth. Exploration mode and other backend-touching features are absent.

---

## Technical Design

### Big picture

The exported HTML file is a **standalone Vite build** of a stripped-down treenote viewer, with the tree data inlined as a `<script>` blob. Everything — JS, CSS, fonts, images — is base64-embedded into one HTML file.

```
exported.html
├── <style>…all CSS inlined…</style>
├── <script>window.__TREENOTE_DATA__ = {tree, theme, exportedAt};</script>
├── <script>…React + viewer bundle, inlined…</script>
└── <div id="root"></div>
```

There is no separate `assets/` directory. One file is the deliverable.

### Two builds, one repo

We add a **second Vite entry point** that builds a viewer-only bundle:

```
src/
  main.jsx               # existing — full app
  viewer/
    main.jsx             # new — viewer-only entry
    Viewer.jsx           # read-only tree renderer
    viewer.html          # shell with inlined data placeholder
```

The viewer reuses the existing rendering components (`NodeContent.jsx`, `Linkify.jsx`, deadline badges, etc.) but **does not import** `App.jsx`, `storage.js`, `supabaseClient.js`, `useKeyboard.js` (full version), or any auth/queue/eject/sync code. It owns a tiny keyboard handler that only does navigation.

`vite.config.js` gets a new build target (`vite build --config vite.viewer.config.js`) that:
- Outputs to `dist-viewer/`.
- Uses [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) (or our own equivalent) to inline all assets into a single HTML file.
- Produces `dist-viewer/viewer.html` — the **template** the runtime uses to generate exports.

This template ships with the main app (copied into `public/` or imported as a raw asset).

### Export at runtime

When the user triggers export:

```js
// src/exportHtml.js
import viewerTemplate from './viewer-template.html?raw';

export function exportNodeAsHtml(node, theme) {
  const payload = {
    tree: stripBackendFields(node),   // strip ids, version, sync metadata
    theme,                            // 'dark' | 'midnight' | 'light'
    exportedAt: new Date().toISOString(),
    sourceUrl: window.location.origin,
  };

  const html = viewerTemplate.replace(
    '<!--TREENOTE_DATA-->',
    `<script>window.__TREENOTE_DATA__ = ${JSON.stringify(payload).replace(/</g, '\\u003c')};</script>`
  );

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = makeFilename(node);
  a.click();
  URL.revokeObjectURL(url);
}
```

Key properties:
- Pure client-side. No server roundtrip.
- The viewer template is fetched once at build time (Vite `?raw` import), bundled into the main app.
- The placeholder `<!--TREENOTE_DATA-->` is a stable string we reserve in the viewer's `index.html`.
- `</` inside JSON is escaped to prevent HTML injection if a node's text contains `</script>`.

### Image handling

Image nodes in treenote store a Supabase Storage URL (see `docs/image-mode.md`). For an export to be self-contained, every image must be **inlined as a data URL**.

At export time:
1. Walk the subtree, collect all `imageUrl` values.
2. Fetch each image, convert to base64, replace `imageUrl` with the data URL in the export payload.
3. Show progress in the toast: "Exporting (3/12 images)…"

Caveats:
- Large image-heavy trees produce huge HTML files. We'll add a soft warning when the projected file size exceeds 10 MB.
- If an image fails to fetch (CORS, deleted), we replace it with a placeholder data URL and continue.

### What gets stripped

The viewer bundle excludes:
- Supabase client and all storage code.
- Auth (`AuthGate.jsx`).
- Save/load logic, undo/redo, optimistic concurrency.
- Queue, eject animation, calendar feed, exploration mode, search, settings panels.
- Mobile Capacitor / widget bridge code.
- Edit-mode keyboard handlers (`useKeyboard.js` is replaced by a much smaller `useViewerKeyboard.js`).

What stays:
- Tree rendering: parent / current / children columns, the connecting lines.
- Slide animation between levels.
- Theme CSS (`theme.css`, all variables).
- Markdown rendering (`marked`), `Linkify`, deadline badges.
- Box-width setting (frozen to whatever the exporter had).

Estimated viewer bundle size: **~80–120 KB gzipped**, vs the current ~194 KB for the full app. React + ReactDOM + marked dominate; the viewer-specific code is tiny.

### Read-only enforcement

The viewer's keyboard handler implements only:
- `ArrowUp/Down` / `j`/`k` — move selection.
- `ArrowLeft` / `h` / `Backspace` — go to parent.
- `ArrowRight` / `l` / `Enter` — go into selected node.
- `Escape` — go to root.
- `?` / `l` — toggle a small in-page legend.

Any other key is swallowed. There is no editor component mounted. Even if a malicious recipient pokes at `window.__TREENOTE_DATA__` in devtools, there's no save endpoint to call — the data is local-only.

### Filename and metadata

- Filename: `treenote-<slug>-<YYYYMMDD>.html`, where `slug` is the root node's text, lowercased, non-alphanumerics → `-`, truncated to 40 chars. Falls back to `treenote-export-<YYYYMMDD>.html` if root text is empty.
- Banner shows: source URL (so recipients can find the live app), export date, exporter's display name (optional, off by default for privacy).

---

## Implementation Plan

Phased so we ship something useful early.

### Phase 1: minimum viable export
- New Vite config, viewer entry, single-file plugin.
- Viewer renders the static tree (no navigation yet — just a flat indented outline).
- Export keybinding + toast.
- No image inlining (image nodes show a "image not exported" placeholder).
- Ship it. This already covers the "share it with others" use case for text-only trees.

### Phase 2: parity navigation
- Port the three-column layout and slide animation to the viewer.
- Arrow-key navigation matching the live app's behavior.
- Read-only legend.

### Phase 3: rich content
- Image inlining with progress toast.
- Markdown nodes render exactly as in the live app.
- File-size warning for large exports.

### Phase 4: discoverability
- "Export" tab in `WebSettingsPanel`.
- Surface the keybinding in the hotkey legend.
- Optional: include exporter display name in banner (opt-in).

---

## Open Questions

1. **Privacy of metadata.** Should we strip node `id`s and timestamps, or keep them? Keeping them helps debugging but leaks more info than the recipient needs. Default: strip.
2. **Checked items.** Do we export them as visible-but-greyed-out, or hide them entirely? Default: visible (it's a snapshot of state, not a TODO list).
3. **Linked references** (queue items, calendar feeds). Out of scope — those are app features, not part of the tree itself.
4. **Updates after export.** Do we want a "re-export and overwrite" flow, or is download-only fine? Start with download-only; revisit if users ask.
5. **Bundle splitting.** Worth code-splitting the viewer template out of the main bundle so users who never export don't pay for it? Probably yes — lazy-load the template via dynamic import on first export.

---

## Non-Goals

- Editing the exported file and re-importing it. Round-trip is out of scope.
- Multi-tree exports. One subtree per file.
- PDF / image export. HTML only.
- Server-side generation. Stays client-only — no new backend surface.
- Authentication / encryption of exports. The file is whatever the exporter shares; standard web sharing rules apply.
