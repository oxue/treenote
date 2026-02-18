# Treenote Architecture

## Module Map

| File | Responsibility | Exports |
|------|---------------|---------|
| `src/App.jsx` | Root component: state declarations, computed values, remaining callbacks, lifecycle effects, JSX layout skeleton | `App` (default) |
| `src/App.css` | Shared/global styles (`.app`, `.toolbar`, `.load-btn`, `.modal-*`, `kbd`, column layout, node boxes) | — |
| `src/parser.js` | Markdown ↔ tree serialization | `parseMarkdownTree`, `serializeTree` |
| `src/actions.js` | Pure tree transformations (insert, delete, swap, move, toggle) | `cloneTree`, `editNodeText`, `insertSiblingBelow`, `insertSiblingAbove`, `insertParent`, `insertChild`, `deleteNodeWithChildren`, `deleteNodeKeepChildren`, `swapUp`, `swapDown`, `toggleChecked`, `deleteCheckedNodes`, `mergeIntoParent`, `moveToParentLevel`, `moveToSibling` |
| `src/components/ChildCount.jsx` | Badge showing unchecked/checked child counts | `ChildCount` (default) |
| `src/components/Linkify.jsx` | Auto-links URLs in text | `Linkify` (default) |
| `src/components/SettingsModal.jsx` | Settings dialog (file path, eject physics). Owns `settingsPath` / `settingsPhysics` state | `SettingsModal` (default) |
| `src/components/SettingsModal.css` | Styles for settings modal | — |
| `src/components/ConfirmModals.jsx` | Delete and clear-checked confirmation dialogs | `DeleteConfirmModal`, `ClearCheckedModal` |
| `src/components/HotkeyLegend.jsx` | Fixed bottom-left hotkey reference panel | `HotkeyLegend` (default) |
| `src/components/HotkeyLegend.css` | Styles for hotkey legend | — |
| `src/components/QueueBar.jsx` | Queue bar + ejecting overlay items | `QueueBar` (default) |
| `src/components/QueueBar.css` | Styles for queue bar | — |
| `src/hooks/useEjectAnimation.js` | Physics animation loop for checked queue items flying off-screen | `useEjectAnimation` (default) → `{ ejecting, ejectQueueItem }` |
| `src/hooks/useSlideAnimation.js` | Horizontal slide transition when navigating tree depth | `useSlideAnimation` (default) → `{ sliderRef, animatingRef, slideNavigate }` |
| `src/hooks/useSvgLines.js` | Computes and updates SVG connector lines between columns | `useSvgLines` (default) → `{ parentColRef, currentColRef, childColRef, leftSvgRef, rightSvgRef, leftLines, rightLines }` |
| `src/hooks/useKeyboard.js` | Global `keydown` listener for all modes (visual, edit, queue, modals) | `useKeyboard` (default) — side-effect only |
| `electron/main.js` | Electron main process | — |
| `electron/preload.js` | Electron preload (exposes `window.treenote` API) | — |

## Data Flow

```
Electron IPC (preload.js)
  → window.treenote.getDefaultFile() / saveDefaultFile() / getSettings() / saveSettings()
  → App.jsx (state owner)
    → actions.js (pure transforms: tree × path × index → { tree, path, selectedIndex })
    → applyAction() pushes undo, updates tree/path/selectedIndex
    → Components receive props, call back via onXxx handlers
```

## State Inventory

All `useState` lives in `App.jsx` unless noted.

| State | Type | Read by | Written by |
|-------|------|---------|------------|
| `tree` | `Node[] \| null` | App, useKeyboard, actions | applyAction, file load, settings save |
| `path` | `number[]` | App, useKeyboard, useSvgLines | applyAction, slideNavigate, useKeyboard |
| `selectedIndex` | `number` | App, useKeyboard, useSvgLines | applyAction, slideNavigate, useKeyboard |
| `mode` | `'visual' \| 'edit'` | App, QueueBar, HotkeyLegend, useKeyboard | enterEditMode, exitEditMode, useKeyboard |
| `undoStack` | `Node[][]` | undo | applyAction, file load |
| `deleteConfirm` | `boolean` | App, useKeyboard | useKeyboard, App (modal callbacks) |
| `clearCheckedConfirm` | `boolean` | App, useKeyboard | useKeyboard, App (modal callbacks) |
| `settingsOpen` | `boolean` | App, useKeyboard | App (gear button, SettingsModal) |
| `settingsInitial` | `{ path, physics }` | App (SettingsModal props) | App (gear button click) |
| `toast` | `string \| null` | App | useKeyboard (Cmd+S), SettingsModal save |
| `queue` | `QueueItem[]` | App, QueueBar, useKeyboard | useKeyboard, useEjectAnimation |
| `queueIndex` | `number` | App, QueueBar, useKeyboard | useKeyboard, useEjectAnimation |
| `physics` | `{ vx, vy, gravity, spin }` | useEjectAnimation, App | App (settings save, startup load) |
| `focus` | `'graph' \| 'queue'` | App, QueueBar, useKeyboard | useKeyboard, useEjectAnimation |
| `ejecting` | `EjectItem[]` | QueueBar | useEjectAnimation (internal) |
| `settingsPath` | `string` | — | SettingsModal (internal) |
| `settingsPhysics` | `object` | — | SettingsModal (internal) |

## Keybinding Map

### Any mode
| Key | Action |
|-----|--------|
| `Cmd+S` | Save file |

### Visual mode — Graph focus
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate siblings |
| `→` | Drill into children |
| `←` | Go to parent |
| `Shift+↑` / `Shift+↓` | Swap node order |
| `Cmd+↑` / `Cmd+↓` | Insert sibling above/below |
| `Cmd+←` | Insert parent |
| `Cmd+→` | Insert child |
| `Alt+↑` / `Alt+↓` | Move to adjacent sibling's children |
| `Alt+←` | Move node to parent level |
| `Enter` | Edit mode |
| `c` | Toggle checked |
| `x` | Delete (shows modal if has children) |
| `Cmd+X` | Clear all checked |
| `z` | Undo |
| `q` | Add to queue |

### Visual mode — Queue focus
| Key | Action |
|-----|--------|
| `←` / `→` | Navigate queue items |
| `Shift+←` / `Shift+→` | Reorder queue items |
| `Cmd+←` / `Cmd+→` | Insert temp box |
| `↓` | Return to graph |
| `c` | Check/eject item |
| `x` | Remove item |
| `Enter` | Edit temp box |
| `q` | Jump to ref item in graph |

### Edit mode
| Key | Action |
|-----|--------|
| `Esc` | Confirm edit and return to visual |

### Modal open
| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Select modal option |
| `Esc` | Cancel/close |

## CSS Conventions

- **Component-specific** CSS lives alongside the component (e.g., `QueueBar.css` imported by `QueueBar.jsx`)
- **Shared selectors** stay in `App.css`: `.load-btn`, `.modal-overlay`, `.modal`, `.modal-title`, `.modal-option`, `kbd`, `.settings-btn`, column/node layout classes
- No CSS modules or CSS-in-JS — plain class selectors
