# Treenote Refactoring Plan

## Validation: Image Mode as Litmus Test

The best test of whether a refactor is worth doing: does it reduce the number of places you'd touch to add a new node rendering mode (like image mode)?

**Current codebase — adding image mode requires changes in:**

| Site | File | Line | What |
|------|------|------|------|
| 1 | App.jsx | 751 | Parent column: add image rendering |
| 2 | App.jsx | 811 | Main column: add `node.image` to meta condition |
| 3 | App.jsx | 815 | Main column: add IMG badge |
| 4 | App.jsx | 895 | Main column: add image rendering |
| 5 | App.jsx | 935 | Child column: add image rendering |
| 6 | App.jsx | 823-894 | Main column: adjust editing textarea to show image above |
| 7 | QueueBar.jsx | 101 | Queue title: add image rendering |
| 8 | QueueBar.jsx | 107 | Queue body: add image rendering |
| 9 | useKeyboard.js | ~242 | Add `case 'i':` in queue focus (442-line file) |
| 10 | useKeyboard.js | ~401 | Add `case 'i':` in graph focus (same file) |
| 11 | App.jsx | — | Add drag-drop handlers to parent box |
| 12 | App.jsx | — | Add drag-drop handlers to main box |
| 13 | App.jsx | — | Add drag-drop handlers to child box |
| 14 | MobileApp.jsx | 299 | Mobile: add image toggle |
| 15 | MobileApp.jsx | 377 | Mobile: add action button |

**15 sites across 4 files.** The same rendering logic written 5 times. High probability of drift, missed spots, inconsistent behavior.

**After refactoring — adding image mode requires:**

| Site | File | What |
|------|------|------|
| 1 | NodeContent.jsx | Add image rendering — ALL columns + queue get it automatically |
| 2 | NodeMeta.jsx | Add IMG badge — ALL columns get it automatically |
| 3 | NodeEditor.jsx | Show image above textarea when editing an image node |
| 4 | actions.js | Add `toggleImage()` |
| 5 | useGraphKeys.js | Add `case 'i':` (~150-line file) |
| 6 | useQueueKeys.js | Add `case 'i':` (~120-line file) |
| 7 | imageUpload.js | New file: upload logic |
| 8 | NodeContent.css | Image display + drag-drop styles |

**8 sites, each touched exactly once.** Rendering logic lives in ONE place. The AI reads NodeContent to see how markdown works, adds image the same way, done.

---

## The Three Core Extractions

These are the refactors that matter. Everything else is cleanup.

### 1. `<NodeContent node={node} />` — all content rendering in one place

**Currently**: the markdown-or-plaintext ternary is copy-pasted at App.jsx:751, :895, :935, QueueBar.jsx:101, :107.

**After**: one component that decides what to render based on node flags.

```jsx
// src/components/NodeContent.jsx
import { marked } from 'marked';
import Linkify from './Linkify';

export default function NodeContent({ node, firstLineOnly }) {
  const text = firstLineOnly ? (node.text || '').split('\n')[0] : node.text;

  if (node.markdown) {
    return <span className="node-text node-markdown"
      dangerouslySetInnerHTML={{ __html: marked.parse(text) }} />;
  }
  return <span className="node-text"><Linkify text={text} /></span>;
}
```

`firstLineOnly` handles QueueBar's case where it only renders the first line.

**Replaced call sites:**
- App.jsx parent column → `<NodeContent node={node} />`
- App.jsx main column → `<NodeContent node={node} />`
- App.jsx child column → `<NodeContent node={child} />`
- QueueBar.jsx title → `<NodeContent node={displayNode} firstLineOnly />`
- QueueBar.jsx body → `<NodeContent node={bodyNode} />` (or keep body separate)

**Future image mode addition** — touch ONLY this file:
```jsx
export default function NodeContent({ node, firstLineOnly }) {
  return (
    <>
      {node.image && node.imageUrl && (
        <div className="node-image-container">
          <img src={node.imageUrl} alt="" />
        </div>
      )}
      {node.image && !node.imageUrl && (
        <div className="image-upload-prompt">Drop image or press Enter</div>
      )}
      {/* existing text/markdown rendering below */}
    </>
  );
}
```

Drag-and-drop handlers also go here — NodeContent wraps its output in a drop target div, accepts an `onImageDrop(nodeId, file)` callback. Every column gets drag-drop for free.

**Files touched**: App.jsx, QueueBar.jsx, +1 new component  
**Risk**: Very low — pure extraction, no logic changes

---

### 2. `<NodeMeta node={node} full={false} />` — all badges in one place

**Currently**: badge rendering appears in two different shapes:

Full meta (main column, App.jsx:811-820):
```jsx
<DeadlineBadge ... />
{node.priority && <span className="priority-badge ...">...</span>}
{node.markdown && <span className="markdown-badge">MD</span>}
{node.checked && <span className="node-check">✓</span>}
{node.children.length > 0 && <span className="child-count">...</span>}
```

Compact meta (parent + child columns, App.jsx:756, :940):
```jsx
{node.checked && <span className="node-check">✓</span>}
<ChildCount children={node.children} />
```

**After**: one component, `full` prop controls detail level.

```jsx
// src/components/NodeMeta.jsx
export default function NodeMeta({ node, full }) {
  const hasAny = node.checked || node.children.length > 0 ||
    (full && (node.deadline || node.priority || node.markdown));
  if (!hasAny) return null;

  return (
    <div className="node-meta">
      {full && <DeadlineBadge ... />}
      {full && node.priority && <span className={`priority-badge ${node.priority}`}>{node.priority}</span>}
      {full && node.markdown && <span className="markdown-badge">MD</span>}
      {node.checked && <span className="node-check">&#10003;</span>}
      {node.children.length > 0 && <span className="child-count">{node.children.length}</span>}
    </div>
  );
}
```

**Future image mode addition** — touch ONLY this file:
```jsx
{full && node.image && <span className="image-badge">IMG</span>}
```

**Files touched**: App.jsx, +1 new component  
**Risk**: Very low

---

### 3. `<NodeEditor>` — editing textarea extracted from inline JSX

**Currently**: 53 lines of inline `<textarea onKeyDown={...} onInput={...} onBlur={...} />` at App.jsx:823-894, handling emoji picker navigation, enter/escape commit, and auto-resize. Tightly coupled to `emojiPicker` state, `settings.enterNewline`, `commitEdit`, `insertEmoji`, `updateEmojiPicker`.

**After**: dedicated component that owns the edit interaction.

```jsx
// src/components/NodeEditor.jsx
export default function NodeEditor({
  node, editInputRef, onCommit,
  emojiPicker, setEmojiPicker, insertEmoji, updateEmojiPicker,
  settings,
}) {
  // 53 lines of textarea logic, moved here verbatim
  return (
    <>
      <span className="edit-icon">&#9998;</span>
      <textarea ref={editInputRef} ... />
    </>
  );
}
```

**Future image mode addition** — touch ONLY this file:
```jsx
return (
  <>
    <span className="edit-icon">&#9998;</span>
    {node.image && node.imageUrl && (
      <div className="node-image-container"><img src={node.imageUrl} alt="" /></div>
    )}
    <textarea ref={editInputRef} ... />
  </>
);
```

**Files touched**: App.jsx, +1 new component  
**Risk**: Low — the props are explicit, logic moves verbatim

---

## Supporting Refactors

These don't directly unblock image mode but reduce complexity in the files image mode touches, making implementation less error-prone.

### 4. Collapse node property setters → `setNodeProperty`

**Problem**: 4 nearly identical useCallbacks in App.jsx (lines 362–404):
`setNodeDeadline`, `setNodePriority`, `setNodeTime`, `setNodeDuration` — all do clone → walk path → set field → pushUndo → setTree.

**Fix**: One generic setter:
```javascript
const setNodeProperty = useCallback((prop, value) => {
  const newTree = cloneTree(tree);
  let nodes = newTree;
  for (const idx of path) nodes = nodes[idx].children;
  nodes[selectedIndex][prop] = value;
  pushUndo();
  setTree(newTree);
}, [tree, path, selectedIndex, pushUndo]);
```

**Image mode benefit**: `setNodeProperty('imageUrl', url)` works immediately — no new callback needed.

**Files touched**: App.jsx, MetadataPanel.jsx  
**Impact**: -24 lines, 4 props → 1 prop

---

### 5. Split useKeyboard by focus domain

**Problem**: 442-line monolith, 34+ params, graph keys and queue keys in one file.

**Fix**: Split into:
```
useKeyboard.js        (~60 lines)  — coordinator: global keys (Cmd+S, modal escapes), delegates by focus
├── useGraphKeys.js   (~150 lines) — arrow/vim nav, node actions (c, x, m, q, d, etc)
└── useQueueKeys.js   (~120 lines) — queue nav, queue item actions
```

**Image mode benefit**: Adding `case 'i':` in a focused 150-line file is easier than in a 442-line file with 34 params. Each sub-hook receives only the params it needs.

**Files touched**: useKeyboard.js → 3 files  
**Risk**: Medium — need to split the dependency arrays correctly

---

### 6. Fix `nodesToYaml` to preserve custom fields

**Problem**: `treeIO.js:nodesToYaml()` strips everything except `text`, `checked`, `children`. All metadata lost on YAML file export.

**Fix**: Preserve all known fields:
```javascript
function nodesToYaml(nodes) {
  return nodes.map(node => {
    const out = { text: node.text, checked: node.checked };
    if (node.markdown) out.markdown = true;
    if (node.deadline) out.deadline = node.deadline;
    if (node.deadlineTime) out.deadlineTime = node.deadlineTime;
    if (node.deadlineDuration) out.deadlineDuration = node.deadlineDuration;
    if (node.priority) out.priority = node.priority;
    out.children = nodesToYaml(node.children);
    return out;
  });
}
```

Mirror in `yamlToNodes` to load them back.

**Image mode benefit**: When image fields are added, they serialize/deserialize automatically if we follow the same pattern. Without this fix, image URLs vanish on YAML export.

**Files touched**: treeIO.js  
**Risk**: Very low

---

### 7. Extract `useToast` hook

**Problem**: Toast pattern repeated 9+ times: `setToast('msg'); setTimeout(() => setToast(null), 2000);`

**Fix**:
```javascript
export default function useToast(duration = 2000) {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, ms) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms || duration);
  }, [duration]);
  return { toast, show };
}
```

**Image mode benefit**: `toast.show('Image uploaded')` — minor convenience.

**Files touched**: App.jsx, +1 new  
**Risk**: Very low

---

## Dropped from original plan

These refactors don't make image mode (or any feature addition) measurably easier:

| Original refactor | Why dropped |
|---|---|
| `useModals` hook | Modal state is independent of image mode. The boolean states aren't the bottleneck — rendering duplication is. Can do later if modals proliferate. |
| `useUndoRedo` hook | Undo/redo is already working and self-contained enough. Extracting it doesn't change how features are added. |
| Extract column components (`<ParentColumn>` etc.) | With NodeContent + NodeMeta + NodeEditor extracted, the column JSX is just ~15 lines of structural wiring each. Not worth the prop-passing overhead of separate components. |
| Shared modal CSS | Pure cosmetic. No feature development impact. |

---

## Execution Order

Ordered by: independence (can commit alone) × image-mode impact.

| # | Refactor | Commit size | Image mode impact |
|---|----------|-------------|-------------------|
| 1 | `<NodeContent>` | Small | **Critical** — eliminates 5x rendering duplication |
| 2 | `<NodeMeta>` | Small | **High** — eliminates 2x badge duplication |
| 3 | `<NodeEditor>` | Medium | **High** — isolates edit interaction for mode-specific behavior |
| 4 | `setNodeProperty` | Small | **Medium** — reusable for `imageUrl` |
| 5 | Split useKeyboard | Medium | **Medium** — focused files for key additions |
| 6 | Fix nodesToYaml | Small | **Medium** — data integrity for new fields |
| 7 | `useToast` | Small | **Low** — minor convenience |

After refactors 1-3, a node's visual representation lives in 3 files with clear responsibilities:
- **NodeContent** — "what does this node look like?" (content modes)
- **NodeMeta** — "what badges does this node have?" (status indicators)
- **NodeEditor** — "what happens when you edit this node?" (edit interaction)

Adding any new mode means touching these 3 files + the action + the keybinding. That's 5 files with clear, predictable locations — not 15 scattered sites.

---

## Post-Refactor File Map

```
src/
├── App.jsx              (~700 lines, down from 1,067)
│   └── wires state, columns, modals — no rendering logic
├── actions.js           (unchanged — pure transforms)
├── storage.js           (unchanged)
├── treeIO.js            (fixed serialization)
├── components/
│   ├── NodeContent.jsx  (NEW — ~20 lines, all content rendering)
│   ├── NodeMeta.jsx     (NEW — ~25 lines, all badge rendering)
│   ├── NodeEditor.jsx   (NEW — ~60 lines, edit textarea + emoji)
│   ├── QueueBar.jsx     (uses NodeContent)
│   ├── ... (other components unchanged)
├── hooks/
│   ├── useKeyboard.js   (~60 lines, coordinator)
│   ├── useGraphKeys.js  (NEW — ~150 lines)
│   ├── useQueueKeys.js  (NEW — ~120 lines)
│   ├── useToast.js      (NEW — ~10 lines)
│   ├── ... (other hooks unchanged)
```
