# Keybindings — Area of Concern

## Design Philosophy
Vim-style: single keys in **visual mode** trigger actions directly (no Ctrl/Cmd combos). Edit mode captures all keys for text input. Modals capture their own keys (number keys for options, Escape to close).

## Module Structure
- `src/hooks/useKeyboard.js` — The single keydown handler. Routes keys based on current `focus` (graph vs queue) and `mode` (visual vs edit). Uses directional helpers from `keybindings.js`.
- `src/keybindings.js` — Directional key helpers (`isUp`, `isDown`, `isLeft`, `isRight`) that support both arrow-key and vim (hjkl) schemes. Also exports `isToggleLegend`, `isVimNavKey`, and `getNavLabels`.
- `src/hooks/useSettings.js` — Persists user settings (including `keybindingScheme`) to localStorage.
- `src/components/WebSettingsPanel.jsx` — Settings UI with keybinding scheme selection.
- `src/App.jsx` — Passes all state and callbacks into `useKeyboard`. Owns `undo/redo` stacks and `pushUndo`.
- `src/hooks/useEjectAnimation.js` — Physics animation for queue item ejection, triggered by `ejectQueueItem()` from keyboard handler.

## Key Routing
1. Modal keys checked first (conflict, settings, backup, delete confirm, etc.) — these block everything else.
2. If `focus === 'queue'` → queue-specific bindings (arrow keys navigate cards, c/x/q operate on queue items).
3. If `focus === 'graph'` and `mode === 'edit'` → keys go to textarea, only Escape exits.
4. If `focus === 'graph'` and `mode === 'visual'` → main navigation and action keys.

## Keybinding Schemes

Two schemes are available, selectable via Settings (`s` key):

### Arrow Keys (default)
Navigation uses arrow keys. All letter keys are available for commands.

### Vim (hjkl)
Navigation uses `h`/`j`/`k`/`l` (arrow keys also work). Letters h/j/k/l are reserved for navigation, so:
- Toggle legend moves from `l` to `?`
- Shift+H/J/K/L = shifted variants (swap, reorder)
- Cmd/Ctrl+H/J/K/L = meta variants (insert node)
- Alt+H/J/K/L = alt variants (move to parent level, move to sibling)

## Key Reference (visual mode, graph focus)
- Navigation keys (arrows or hjkl): navigate tree (up/down = siblings, left/right = parent/child)
- `Enter`: edit selected node
- `z` / `Z`: undo / redo
- `c`: toggle checked
- `x`: delete node (confirms if has children)
- `q`: send node to queue
- `d`: open deadline/metadata panel
- `f`: open calendar feed modal
- `m`: toggle markdown mode
- `l` (arrows) / `?` (vim): toggle legend
- `s`: settings
- `b`: backup manager

## Key Reference (visual mode, queue focus)
- Left/Right navigation keys: navigate queue items
- Shift+Left/Right: reorder queue items
- Cmd+Left/Right: insert temp card
- Down: return to graph
- `Enter`: edit queue item
- `c`: check off and eject (with physics animation)
- `x`: delete from queue
- `q`: jump to referenced node in tree
- `d`: open deadline/metadata panel (ref items)
- `m`: toggle markdown (ref items)
- `f`: open calendar feed modal
- `z` / `Z`: undo / redo
- `l` (arrows) / `?` (vim): toggle legend

## Rules for Modifying
- Always read `useKeyboard.js` before changing any key behavior.
- Queue mutations (c, x) must call `pushUndo()` before mutating state.
- New modals must add their key handler block before the focus routing.
- The dependency array at the bottom of the useEffect must include any new state/callback you reference.
