# Image Mode — Design Spec

## Overview

Any box can become an **image box** by pressing `I`. An image box displays a single image instead of (or alongside) text. Users can populate it via file picker or drag-and-drop.

---

## Mode Model

Today a box has two implicit modes controlled by boolean flags:

| Flag       | Visual | Behavior |
|------------|--------|----------|
| (default)  | Plain text | `<Linkify>` rendering |
| `markdown` | Rendered markdown | `marked.parse()` rendering |

Adding image mode introduces a third flag:

| Flag       | Visual | Behavior |
|------------|--------|----------|
| `image`    | Image display | `<img>` rendering from URL |

### Interaction between modes

**Markdown and image are independent flags** — they don't conflict:
- A box can be plain text only, markdown only, image only, or image + markdown (caption rendered as markdown below image).
- `M` toggles `node.markdown`. `I` toggles `node.image` (the display flag). They're orthogonal.
- When `image` is true but no `imageUrl` is set, the box shows an upload prompt instead of the image.

### Node data additions

```javascript
{
  // existing fields
  text: string,
  checked: boolean,
  children: Node[],
  markdown: boolean,

  // new fields
  image: boolean,      // true = image mode enabled (controls rendering)
  imageUrl: string,    // URL to the stored image (Supabase Storage public URL)
}
```

**Persistence**: These fields are saved to Supabase as part of the JSON tree (same as `markdown`, `deadline`, `priority`). They will NOT survive YAML file export/import — same limitation as all other custom fields. Fixing YAML serialization is out of scope for this feature but noted as a future improvement.

---

## Keybinding

**Key**: `I` (in visual mode, graph and queue focus)

**Behavior**:
- If selected box has no image yet: sets `node.image = true` and opens file picker.
- If selected box already has an image: toggles `node.image` (hides/shows the image — doesn't delete it).
- The image URL stays on the node even when `image` is toggled off, so toggling back on restores it instantly.

**In `useKeyboard.js`** — add `case 'i':` blocks in both graph-focus and queue-focus switch statements, following the same pattern as `case 'm':` for markdown toggle.

**Action in `actions.js`**:
```javascript
export function toggleImage(tree, path, selectedIndex) {
  const newTree = cloneTree(tree);
  const node = getNodeAt(newTree, path, selectedIndex);
  node.image = !node.image;
  return { tree: newTree, path, selectedIndex };
}
```

---

## Image Upload

### Storage backend: Supabase Storage

Create a bucket `node-images` in Supabase Storage.
- **Path convention**: `{userId}/{nodeId}/{timestamp}.{ext}` — dedupes by node, allows replacing.
- **Public bucket** — images served via public URL (no auth needed to view, matches anon-key-is-public model).
- **Max file size**: 5 MB (enforce client-side before upload).
- **Accepted formats**: `image/png`, `image/jpeg`, `image/gif`, `image/webp`.

### Upload flow

```
User triggers upload (file picker or drop)
  → validate type + size client-side
  → upload to Supabase Storage via supabase.storage.from('node-images').upload(...)
  → get public URL via getPublicUrl()
  → set node.imageUrl = publicUrl, node.image = true
  → applyAction() to update tree
  → auto-save triggers as normal
```

### New module: `src/imageUpload.js`

Isolate upload logic from UI:

```javascript
export async function uploadNodeImage(file, userId, nodeId) {
  // validate type + size
  // upload to supabase storage
  // return public URL
}

export async function deleteNodeImage(userId, nodeId) {
  // remove from storage bucket
}
```

---

## Upload UX — Two Entry Points

### 1. File picker (triggered by `I` key)

When `I` is pressed on a box with no image:
1. Toggle `node.image = true`.
2. Programmatically click a hidden `<input type="file" accept="image/*">`.
3. On file selection → upload → set `imageUrl`.
4. If user cancels the picker → box stays in image mode with the upload prompt visible (they can drop an image or press `I` again to exit).

Implementation: Add a hidden file input ref (like the existing `fileInputRef` for YAML import) dedicated to image uploads. Store a pending `{ path, selectedIndex }` so the `onChange` handler knows which node to update.

### 2. Drag-and-drop

When a file is dragged over a box that has `image: true`:
1. Show a drop zone overlay on the box.
2. On drop → upload → set `imageUrl`.

When a file is dragged over ANY box (even one not in image mode):
1. Auto-enable image mode on drop.
2. Upload and set URL.

This means drag-and-drop is a shortcut that bypasses the need to press `I` first.

**Implementation**: Add `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` handlers to `.node-box` elements. Use a `dragTarget` state to track which box is being hovered for the visual overlay.

---

## Rendering

### Image box (when `node.image && node.imageUrl`)

```
┌─────────────────────────┐
│ [IMG badge]   [3]       │  ← node-meta (top right)
│                         │
│   ┌───────────────┐     │
│   │               │     │
│   │    <image>    │     │
│   │               │     │
│   └───────────────┘     │
│                         │
│  Optional text/caption  │  ← shown below image if node.text exists
│                         │
└─────────────────────────┘
```

- Image is rendered with `max-width: 100%; border-radius: 6px`.
- If `node.markdown` is also true, the caption text renders as markdown.
- If `node.text` is empty, only the image shows (no caption area).

### Upload prompt (when `node.image && !node.imageUrl`)

```
┌─────────────────────────┐
│ [IMG badge]             │
│                         │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   │  Drop image or  │   │  ← dashed border, muted text
│   │  press Enter to │   │
│   │     upload      │   │
│   └ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                         │
└─────────────────────────┘
```

- Dashed border placeholder, clickable (opens file picker on click too).
- `Enter` in visual mode on an image box with no URL → opens file picker (alternative to clicking).

### Drag overlay (when dragging a file over a box)

```
┌─────────────────────────┐
│                         │
│      Drop to upload     │  ← semi-transparent overlay with accent border
│                         │
└─────────────────────────┘
```

### Badge

In `.node-meta`, add:
```jsx
{node.image && <span className="image-badge">IMG</span>}
```

Styled identically to `.markdown-badge` — small pill, accent colors.

---

## Editing behavior

- **Visual mode**: Image displays. Arrow keys navigate normally. `I` toggles image mode.
- **Edit mode** (`Enter`): 
  - If box has an image: edit the text/caption below the image (textarea appears below image).
  - The image remains visible while editing the caption.
  - To replace the image: press `I` again to re-trigger file picker, or drag-drop a new file.
- **Delete image**: New action — `Shift+I` removes `imageUrl` (returns to upload prompt) or toggles image mode off entirely. Alternatively, a simpler approach: `I` toggles the mode off, and if the user toggles it back on, the old URL is still there. To actually clear the image, we can add this to the option modal or keep it simple with `I` cycling: on → off → (press I again) → on with file picker if URL was cleared.

**Recommended approach** (simple):
- `I` on a box with no image → enable image mode + open picker.
- `I` on a box with an image → disable image mode (image hidden but URL preserved).
- `I` again → re-enable image mode (image reappears from preserved URL).
- To replace: drag-drop a new image, or enter edit mode and use a "replace image" action.

---

## CSS

New classes in `App.css`:

```css
/* Badge */
.image-badge { /* same pattern as .markdown-badge */ }

/* Image display */
.node-image-container { text-align: center; margin-bottom: 8px; }
.node-image-container img { max-width: 100%; border-radius: 6px; }

/* Upload prompt */
.image-upload-prompt {
  border: 2px dashed var(--border-secondary);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  cursor: pointer;
}

/* Drag overlay */
.node-box.drag-over { border-color: var(--accent); background: var(--accent-bg); }
```

---

## Files to modify

| File | Changes |
|------|---------|
| `src/actions.js` | Add `toggleImage()`, `setImageUrl()` actions |
| `src/hooks/useKeyboard.js` | Add `case 'i':` in graph-focus and queue-focus |
| `src/App.jsx` | Image rendering, file input, drag-drop handlers, badge |
| `src/App.css` | `.image-badge`, `.node-image-container`, `.image-upload-prompt`, drag styles |
| `src/imageUpload.js` | **New file** — upload/delete logic for Supabase Storage |
| `src/components/QueueBar.jsx` | Image rendering in queue items |
| `src/MobileApp.jsx` | Image rendering + upload for mobile (can defer) |

---

## Supabase setup

1. Create `node-images` storage bucket (public).
2. RLS policy: users can only upload/delete within their own `{userId}/` prefix.
3. No DB migration needed — image data lives on the tree JSON, not in a separate table.

---

## Out of scope (future)

- **Multiple images per box** — v1 is one image per box.
- **Image resizing/cropping** — use as-uploaded, CSS constrains display.
- **YAML export** — custom fields (including `imageUrl`) are stripped by `nodesToYaml()`. Fixing serialization for all custom fields is a separate effort.
- **Image paste from clipboard** — nice UX enhancement, add after core works.
- **Mobile-specific upload** (camera, photo library) — defer to after web works.
