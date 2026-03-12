# Keybindings — Area of Concern

## Design Philosophy
Vim-style: single keys in **visual mode** trigger actions directly (no Ctrl/Cmd combos). Edit mode captures all keys for text input. Modals capture their own keys (number keys for options, Escape to close).

## Module Structure
- `src/hooks/useKeyboard.js` — The single keydown handler. Routes keys based on current `focus` (graph vs queue) and `mode` (visual vs edit). All keybinding logic lives here.
- `src/App.jsx` — Passes all state and callbacks into `useKeyboard`. Owns `undo/redo` stacks and `pushUndo`.
- `src/hooks/useEjectAnimation.js` — Physics animation for queue item ejection, triggered by `ejectQueueItem()` from keyboard handler.

## Key Routing
1. Modal keys checked first (conflict, settings, backup, delete confirm, etc.) — these block everything else.
2. If `focus === 'queue'` → queue-specific bindings (arrow keys navigate cards, c/x/q operate on queue items).
3. If `focus === 'graph'` and `mode === 'edit'` → keys go to textarea, only Escape exits.
4. If `focus === 'graph'` and `mode === 'visual'` → main navigation and action keys.

## Key Reference (visual mode, graph focus)
- Arrow keys: navigate tree (up/down = siblings, left/right = parent/child)
- `Enter`: edit selected node
- `z` / `Z`: undo / redo
- `c`: toggle checked
- `x`: delete node (confirms if has children)
- `q`: send node to queue
- `d`: open deadline/metadata panel
- `f`: open calendar feed modal
- `m`: toggle markdown mode
- `l`: toggle legend
- `s`: settings

## Key Reference (visual mode, queue focus)
- Left/Right arrows: navigate queue items
- Shift+Left/Right: reorder queue items
- Cmd+Left/Right: insert temp card
- Down arrow: return to graph
- `Enter`: edit queue item
- `c`: check off and eject (with physics animation)
- `x`: delete from queue
- `q`: jump to referenced node in tree
- `d`: open deadline/metadata panel (ref items)
- `m`: toggle markdown (ref items)
- `f`: open calendar feed modal
- `z` / `Z`: undo / redo
- `l`: toggle legend

## Rules for Modifying
- Always read `useKeyboard.js` before changing any key behavior.
- Queue mutations (c, x) must call `pushUndo()` before mutating state.
- New modals must add their key handler block before the focus routing.
- The dependency array at the bottom of the useEffect must include any new state/callback you reference.
