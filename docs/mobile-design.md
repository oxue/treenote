# Treenote Mobile — Design Document

*Created: 2026-03-27*

## Philosophy

The mobile app is **not a port of the desktop app**. It's a focused companion that retains the core mental model — tree + queue — but reimagines every interaction for touch. The guiding principles:

1. **One thing at a time** — never show more than one tree level or one queue card at once.
2. **Quick actions at your thumb** — check, swipe-delete, and reorder without entering a mode.
3. **Edit mode for the rest** — metadata, text editing, and advanced operations happen in a focused editing state.
4. **No hotkeys, no legend** — every action must be discoverable through UI affordances.

---

## Screen Architecture

The app has **three screens** accessed from a persistent bottom tab bar:

```
┌─────────────────────────────┐
│                             │
│       Active Screen         │
│                             │
├─────────────────────────────┤
│  🌲 Tree  │  📋 Queue  │  ⚙ Settings │
└─────────────────────────────┘
```

### Tab Bar
- Fixed to bottom, respects safe area insets.
- Three equal-sized tabs: **Tree**, **Queue**, **Settings**.
- Active tab highlighted with accent color.

---

## Screen 1: Tree

### Layout

```
┌─────────────────────────────┐
│ ← Breadcrumb: Root > Work   │   ← tap any crumb to jump back
├─────────────────────────────┤
│ ▶ Project Alpha         (3) │   ← tap arrow to expand inline
│   Design sprint              │     OR tap row to drill in
│   Ship v2.0                  │
│ ▶ Personal              (5) │
│   Buy groceries         ✓   │   ← checked nodes dimmed
│   Call dentist               │
│                              │
│                         [+]  │   ← floating add button
└─────────────────────────────┘
```

### Navigation
- **Single column** showing one level of the tree at a time (the children of the current parent).
- **Breadcrumb bar** at top shows the path. Tap any crumb to jump back.
- **Tap a node** → drill into its children (animate slide-left, new column appears).
- **Back** → tap breadcrumb or swipe right from edge to go up one level.
- Child count badge `(N)` shown on nodes that have children.

### Quick Actions (no mode switch needed)
| Gesture | Action |
|---------|--------|
| Tap node | Drill into children |
| Long press node | Show action menu (edit, delete, add to queue, set metadata) |
| Swipe left on node | Reveal check ✓ and delete ✕ buttons |
| Tap [+] FAB | Add new sibling at current level |
| Drag handle (left edge) | Reorder nodes within current level |

### Action Menu (long press)
A bottom sheet with options:
- **Edit** — enter edit mode for this node
- **Add child** — create a child node
- **Add to queue** — send to queue as ref item
- **Set deadline / priority** — opens metadata editor
- **Delete** — delete with confirmation (keep children? or delete all?)
- **Toggle markdown**

### Edit Mode
Triggered from the action menu or by tapping the node text area in the action menu. Presents a **full-screen editor**:

```
┌─────────────────────────────┐
│ Cancel              Done     │
├─────────────────────────────┤
│                              │
│  [Text editor - multiline]   │
│                              │
├─────────────────────────────┤
│ 📅 Mar 28   ⏰ 2:00 PM      │  ← metadata row
│ ⏱ 1h        🔴 High         │
├─────────────────────────────┤
│ 🔽 Markdown: ON              │
└─────────────────────────────┘
```

- **Text area** — full multiline editing with keyboard.
- **Metadata row** — tap any field to edit inline (date picker, time picker, priority selector).
- **Markdown toggle** — switch at bottom.
- **Cancel** — discard changes. **Done** — save changes.
- This is where metadata lives on mobile, combined with text editing. No separate "d" key flow.

---

## Screen 2: Queue

### Layout

```
┌─────────────────────────────┐
│ QUEUE                 3 left │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🍽️ Dishes              │ │  ← current card, large
│ │                          │ │
│ │ 📅 Today    🔴 High     │ │
│ └─────────────────────────┘ │
│                              │
│   ○ ○ ● ○ ○                 │  ← page dots
│                              │
│  [+]                         │  ← add temp item
└─────────────────────────────┘
```

### Card Pager
- **Horizontal swipe** to navigate between queue items — one card fills most of the screen.
- Page indicator dots below the card.
- Current card shows: full text (with markdown rendering), deadline badge, priority badge, ref/temp indicator.

### Quick Actions on Cards
| Gesture | Action |
|---------|--------|
| Swipe left/right | Navigate between cards |
| Tap checkbox | Toggle checked state |
| Swipe down on card | Check off item (with animation) |
| Swipe up on card | Delete item (with confirmation) |
| Tap card text | Enter edit mode (same full-screen editor as tree) |
| Tap [+] | Add new temp queue item |
| Long press | Reorder menu (move left/right in queue) |

### Checked Items
- Checked cards go to the end of the queue.
- They appear dimmed with strikethrough.
- A "Clear checked" button appears when there are checked items.

### Jump to Tree
- For `ref` items, a **"Show in tree"** button on the card navigates to Screen 1 and drills into the node's location.

---

## Screen 3: Settings

### Layout

```
┌─────────────────────────────┐
│ Settings                     │
├─────────────────────────────┤
│                              │
│ APPEARANCE                   │
│ ┌──────────────────────────┐ │
│ │ Theme          Midnight ▸│ │
│ │ Default markdown     ON  │ │
│ └──────────────────────────┘ │
│                              │
│ DATA                         │
│ ┌──────────────────────────┐ │
│ │ Backups              (12)▸│ │
│ │ Calendar feed            ▸│ │
│ └──────────────────────────┘ │
│                              │
│ ACCOUNT                      │
│ ┌──────────────────────────┐ │
│ │ Signed in as             │ │
│ │ oxu.wex@gmail.com        │ │
│ │ Logout                   │ │
│ └──────────────────────────┘ │
│                              │
│ v1.0.0                       │
└─────────────────────────────┘
```

### Sections
- **Appearance**: Theme picker (push to sub-screen with preview), default markdown toggle.
- **Data**: Backups list (push to sub-screen), calendar feed URL (copy button).
- **Account**: Email display, logout button.
- No hotkey settings — not applicable to mobile.
- No physics settings — queue check-off animation can use sensible defaults.

---

## Interaction Patterns

### Gestures Summary

| Context | Tap | Long press | Swipe left | Swipe right | Swipe down | Swipe up |
|---------|-----|------------|------------|-------------|------------|----------|
| Tree node | Drill in | Action menu | Check / Delete | — | — | — |
| Queue card | Edit | Reorder | Next card | Prev card | Check off | Delete |
| Breadcrumb | Jump to level | — | — | — | — | — |

### Mode Model
The mobile app has only two modes:
1. **Browse mode** (default) — navigate, quick actions, gestures.
2. **Edit mode** — full-screen editor for text + metadata. Entered explicitly, exited with Cancel/Done.

No visual/insert/command modes like the desktop. Every action is either a gesture or a menu item.

---

## Data Operations

### What's shared with desktop
- Same Supabase backend, same `user_trees` table.
- Same `tree_data`, `queue_data`, `version` columns.
- Same optimistic concurrency (version check on save).
- Same auth (Google OAuth).

### Mobile-specific behavior
- **Auto-save** — save after every mutation (no manual Cmd+S needed).
- **Conflict handling** — if version mismatch, show simple "Data updated elsewhere — reload?" prompt. No three-way merge on mobile.
- **Widget sync** — write queue snapshot to App Group on every queue change.

### Undo
- **Single-level undo** via a toast: "Deleted node. [Undo]" — appears for 5 seconds after destructive actions.
- No multi-step undo stack on mobile (keep it simple).

---

## Implementation Plan

### Phase 1: Core Navigation
- [ ] Bottom tab bar (Tree / Queue / Settings)
- [ ] Tree screen: single-column view, breadcrumb, drill-in/out
- [ ] Queue screen: horizontal card pager
- [ ] Settings screen: static list

### Phase 2: Quick Actions
- [ ] Swipe-to-check and swipe-to-delete on tree nodes
- [ ] Swipe gestures on queue cards
- [ ] FAB for adding nodes/items
- [ ] Long-press action menu on tree nodes

### Phase 3: Edit Mode
- [ ] Full-screen text editor
- [ ] Metadata editing (deadline, time, duration, priority)
- [ ] Markdown toggle
- [ ] Save/cancel flow

### Phase 4: Data Sync
- [ ] Auto-save after mutations
- [ ] Conflict detection and reload prompt
- [ ] Widget data bridge working end-to-end
- [ ] Undo toast for destructive actions

### Phase 5: Polish
- [ ] Animations (slide transitions, check-off effects)
- [ ] Theme support (Dark, Midnight, Light)
- [ ] Backup management screen
- [ ] Calendar feed copy screen
- [ ] Empty states (empty tree, empty queue)

---

## What's NOT in Mobile

These desktop features are intentionally excluded:
- Hotkey legend / keybindings configuration
- Vim mode
- Three-column tree view (parent / current / children)
- Physics configuration for eject animation
- File import/export
- Multi-step undo/redo stack
- Emoji picker (use system keyboard emoji instead)
- SVG connection lines between nodes
