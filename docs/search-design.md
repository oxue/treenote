# Search (Cmd+K) — Design Spec

## Overview
Spotlight-style search for navigating the tree. Press Cmd+K, type, arrow through results, Enter to jump there.

## Trigger
`Cmd+K` (or `Ctrl+K` on non-Mac). Works from any state — visual mode, edit mode, or even with another modal open. Always takes priority.

## Interaction Flow

1. `Cmd+K` → floating search bar appears with blurred overlay
2. Cursor is in the input immediately — just start typing
3. Results filter in real-time below the input (case-insensitive substring match on `node.text`)
4. `Arrow Up/Down` → move selection highlight through results
5. `Enter` → navigate to selected node, close search
6. `Escape` → close search, return to previous state

## Visual Layout

```
┌─────────────────────────────────────────────┐
│  🔍  search your tree...              Cmd+K │
├─────────────────────────────────────────────┤
│  ▸ parent > parent > matching node          │
│    "...the matched text with highlight..."  │
│─────────────────────────────────────────────│
│  ▸ another > path > result        [selected]│
│    "...matched text..."                     │
│─────────────────────────────────────────────│
│  ▸ deep > nested > result                   │
│    "...matched text..."                     │
└─────────────────────────────────────────────┘
```

### Position
Top-third of viewport, horizontally centered. Not vertically centered — Spotlight and Cmd+K palettes sit high because your eyes are already near the top of the screen.

### Dimensions
- Width: `min(600px, 90vw)`
- Max height: 8 results visible, scrollable if more
- Border radius: 14px (matches existing modals)

### Input bar
- No visible border — just text on `--bg-panel`
- Font size: 18-20px (larger than body text, feels like Spotlight)
- Placeholder: "Search your tree..." in `--text-ghost`
- Right-aligned `Cmd+K` kbd hint in `--kbd-text` (disappears when typing)
- Search icon (magnifying glass) left-aligned, `--text-faint`

### Result rows
Each result shows two lines:
1. **Breadcrumb path** — `parent > parent > node name` in `--text-secondary`, truncated from the left if too long
2. **Matched text snippet** — the matching portion of `node.text` with the search term highlighted in `--accent`

### Selection state
- First result is selected by default
- Selected result has `--accent-bg` background
- Arrow keys move selection, wrapping at top/bottom

### Empty states
- **No query typed:** show nothing below the input (no suggestions, no recent nodes)
- **No matches:** single row saying "No results" in `--text-faint`
- **More than 50 matches:** show first 50, then a row saying "and N more..." in `--text-faint`

## Search Logic

### Matching
- Flatten the tree recursively into `[{ node, path, index }]`
- Case-insensitive substring match on `node.text`
- No fuzzy matching — keep it simple and predictable

### Result ordering
1. Exact prefix matches first (query matches the start of node text)
2. Then by tree order (depth-first traversal order — results appear in the order you'd encounter them navigating down the tree)

### Performance
- Flatten on open (not on every keystroke). Cache the flat list.
- Filter on every keystroke against the cached flat list.
- Cap at 50 results to stay fast.

## Navigation on Select

```javascript
const { path, index } = selectedResult;
setPath(path);
setSelectedIndex(index);
setSearchOpen(false);
setMode('visual');
setFocus('graph');
```

Use `slideNavigate` if the target is adjacent to the current view, otherwise just set state directly (the slide animation doesn't make sense for a jump across the tree).

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| In edit mode when Cmd+K pressed | Exit edit mode, open search |
| Another modal open when Cmd+K pressed | Close that modal, open search |
| Checked/completed nodes | Still searchable |
| Queue items | Not searched — queue is already visible |
| Node text has newlines | Match against full text, show first line in result |
| Node text is empty | Skip in results (empty nodes aren't useful to search for) |
| Tree is null/loading | Don't open search |

## Overlay
Reuses the existing `.modal-overlay` pattern: fixed position, full screen, `--bg-overlay` background, `backdrop-filter: blur(4px)`, `z-index: 200`. Clicking the overlay closes search.

## Files to Change

| File | What |
|------|------|
| `src/components/SearchModal.jsx` | New — the search UI component |
| `src/components/SearchModal.css` | New — styles for search bar and results |
| `src/hooks/useKeyboard.js` | Add Cmd+K handler early in the event chain (before modal checks) |
| `src/App.jsx` | Add `searchOpen` state, render `<SearchModal>`, pass `tree` + `setPath` + `setSelectedIndex` |
| `src/actions.js` | Add `flattenTree(tree)` → `[{ node, path, index }]` |
