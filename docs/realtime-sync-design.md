# Real-Time Sync — Design Spec

## Problem
When using treenote on two tabs or devices, saves trigger a conflict modal asking "keep mine / keep theirs / keep both." This is confusing — the user doesn't know what to choose. The expected behavior is Google Docs-like: you're always on the most up-to-date version, no modals.

## Key Insight
This is single-user multi-device sync, NOT multi-user collaboration. True simultaneous conflicts (editing on two devices within the same 2-second save window) are near-impossible. We don't need CRDTs, OT, or any heavy machinery. We just need every tab to stay in sync with the server.

## Design: "Shoulder Tap" + Pull Latest

The architecture has three layers, from cheapest to most involved:

### Layer 1: Same-Device Tab Sync (BroadcastChannel API)
For two browser tabs on the same machine. Zero server cost, instant.

```
Tab A saves → BroadcastChannel.postMessage({ type: 'tree_updated', version: N })
Tab B receives → pulls latest from Supabase (or directly from the message payload)
```

- Use the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) with channel name `treenote-sync`
- On save success: broadcast `{ type: 'tree_updated', version, tree }` to other tabs
- On receive: if incoming version > local version, replace local tree and version. No modal.
- The tree payload is included in the message so the other tab doesn't even need a network round-trip

### Layer 2: Cross-Device Sync (Supabase Realtime)
For two different computers or phone + desktop. Uses WebSocket push.

```
Device A saves to Supabase → Postgres Changes fires
Device B receives WebSocket notification → fetches latest tree
```

- Subscribe to Postgres Changes on `user_trees` filtered by `user_id`:
  ```javascript
  supabase
    .channel('tree-sync')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'user_trees',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      const serverVersion = payload.new.version;
      if (serverVersion > localVersion) {
        // Pull and replace
        setTree(payload.new.tree_data);
        setVersion(serverVersion);
      }
    })
    .subscribe()
  ```
- The notification payload includes the new row data, so no extra fetch needed
- If the WebSocket disconnects, fall back to Layer 3

### Layer 3: Pull-on-Focus (Fallback)
For when WebSocket is disconnected, or as belt-and-suspenders.

```
Tab gains focus → fetch latest from Supabase → if newer, replace local state
```

- Listen to `document.addEventListener('visibilitychange', ...)` 
- When `document.visibilityState === 'visible'`, call `loadUserTree(userId)`
- If server version > local version, replace tree silently
- Also pull on reconnect (when Supabase Realtime channel status changes to `SUBSCRIBED` after a disconnect)

## Save Flow (Replacing Conflict Modal)

### Current (broken)
```
User edits → debounce 1.5s → saveUserTree(userId, tree, expectedVersion)
  → if version mismatch → show ConflictModal (confusing)
```

### New (no modal)
```
User edits → debounce 1.5s → saveUserTree(userId, tree, expectedVersion)
  → if version mismatch:
    1. Fetch latest server tree + version
    2. Replace local tree with server tree
    3. Apply user's latest edit on top of the fresh tree (or discard if stale)
    4. Save again with correct version
    5. No modal. Silent.
```

The "apply edit on top" step is optional complexity. For v1, just **pull the server version and discard the stale local edit**. Since this is single-user, the "conflict" means the user saved from another tab/device moments ago — the server version IS their latest work. Discarding the stale local state is correct 99% of the time.

If the user was actively typing in this tab when the conflict happened (rare), show a **toast notification** instead of a modal: "Synced from another device" — so they know their view just refreshed. No choices to make.

## What Gets Deleted

- `src/components/ConflictModal.jsx` — removed entirely
- All conflict-related state in `App.jsx` (`conflictData`, `showConflict`, etc.)
- The `onKeepMine` / `onKeepTheirs` / `onKeepBoth` callbacks

## What Gets Added

| File | Change |
|------|--------|
| `src/hooks/useRealtimeSync.js` | New hook — manages all three sync layers |
| `src/storage.js` | Add `subscribeToTreeChanges(userId, callback)` wrapper |
| `src/App.jsx` | Wire up `useRealtimeSync`, remove conflict modal |
| `src/App.css` | Toast style for "Synced from another device" |

## useRealtimeSync Hook

```javascript
function useRealtimeSync(userId, tree, version, setTree, setVersion) {
  // Layer 1: BroadcastChannel for same-device tabs
  // Layer 2: Supabase Realtime for cross-device
  // Layer 3: Pull-on-focus as fallback
  
  // On any incoming update where serverVersion > localVersion:
  //   setTree(serverTree)
  //   setVersion(serverVersion)
  //   show toast "Synced from another device"
  
  // On save: broadcast to BroadcastChannel after successful save
}
```

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| Two tabs, user edits tab A, switches to tab B | Tab B receives BroadcastChannel message instantly. No flash, no modal. |
| Two devices, user edits phone, opens laptop | Laptop receives Supabase Realtime push. Tree updates silently. |
| Device offline for an hour, comes back | Pull-on-focus fetches latest. Replaces local state. Toast shown. |
| User is actively typing when sync arrives | Don't interrupt mid-edit. Queue the sync and apply when user exits edit mode (presses Escape). Show a subtle indicator that a newer version is available. |
| WebSocket disconnects | Falls back to pull-on-focus. Reconnects automatically (supabase-js handles this). |
| Both tabs edit different nodes within 2 seconds | Last save wins. Since it's one user, the server version is always their own latest work. |
| Both tabs edit the SAME node within 2 seconds | Last save wins. One edit is lost. This is acceptable — the user caused it and the window is tiny. |
| Queue data | Apply same pattern — broadcast queue changes too. |

## What This Does NOT Solve (Future Work)

- **Offline editing** — if you edit while offline, those edits are lost when you reconnect and pull the server version. Solving this requires either a CRDT or an operation log. Out of scope for now.
- **Multi-user collaboration** — this design is single-user only. For collaboration, you'd need per-node rows or a CRDT. Out of scope.
- **Merge** — there is no merge. Server always wins. This is correct for single-user because the server version IS your latest work from another tab/device.

## Why Not Per-Node Rows Now?

Decomposing the tree into individual rows (each node = a row) would structurally eliminate conflicts and open the path to collaboration. But it requires:
- A database migration (new `nodes` table, flatten existing trees)
- Rewriting all tree operations to work on individual rows instead of a JSON blob
- Reconstructing the tree in memory from rows on every load
- Handling ordering with fractional indices

**DB interaction complexity comparison:**

| Operation | JSON blob (current) | Per-node rows |
|-----------|-------------------|---------------|
| Load tree | 1 query (SELECT one row) | 1 query (SELECT N rows) + reconstruct in memory |
| Edit node text | 1 query (rewrite entire blob) | 1 query (UPDATE one row) |
| Insert node | 1 query (rewrite entire blob) | 1 INSERT + UPDATE sibling positions |
| Delete node | 1 query (rewrite entire blob) | 1 DELETE cascade to descendants |
| Move node | 1 query (rewrite entire blob) | 3+ queries (update parent_id + positions in old and new parent) |
| Reorder siblings | 1 query (rewrite entire blob) | N UPDATEs (one per shifted sibling) |

With per-node rows, every tree action in `actions.js` (14 operations currently) needs a corresponding DB write. Complex operations like move/reorder touch multiple rows and should be batched into Postgres RPCs for atomicity. The pure-function boundary in `actions.js` breaks — persistence becomes entangled with tree logic.

This is the right long-term architecture but wrong for this week. The shoulder-tap design ships with minimal changes to the existing data model and eliminates 100% of the user-facing pain.

---

## Extended Edge Cases Analysis

### Sync timing edges

| Situation | What happens | Risk | Mitigation |
|-----------|-------------|------|------------|
| User types fast, debounce fires, another tab's save arrives during debounce window | The debounced save has a stale version. Save fails silently. | Edit appears lost to the user — they typed something and it vanished. | On version mismatch during save: fetch server tree, re-apply the current edit buffer (the text in the active textarea) on top, retry save. |
| User opens app on phone while laptop has unsaved debounced edits | Phone loads whatever version is on server. Laptop's debounce fires 1s later and saves. Phone gets the Realtime push and updates. | Brief flash of stale state on phone (~1-2s). | Acceptable. The phone self-corrects within the debounce window. |
| Two devices both offline, both make edits, both come back online | First device to save wins. Second device pulls on focus and overwrites its local edits with server state. | Edits from second device are lost. | Show a toast: "Newer version loaded from another device. Your unsaved changes were discarded." This is the one case where data loss is real. For v1, accept it. For v2, see the offline section in Future Plan. |
| Supabase Realtime hits rate limit (100 msg/sec free, 500 pro) | WebSocket connection dropped, auto-reconnects. | Missed updates during disconnect window. | Pull-on-focus (Layer 3) catches up. Also pull on Realtime reconnect. |
| BroadcastChannel message arrives with tree larger than structuredClone limit | Silently fails on very old browsers. | Extremely unlikely — structured clone handles objects well. | Catch errors, fall back to "pull from server" instead of using the broadcast payload. |

### State consistency edges

| Situation | What happens | Risk | Mitigation |
|-----------|-------------|------|------------|
| Sync arrives while user is in edit mode (typing in a node) | If we replace the tree, the textarea loses focus and content. | Very disruptive — user loses their cursor position and train of thought. | **Never replace tree during edit mode.** Set a `pendingSync` flag. When user exits edit mode (Escape), apply the pending sync. Show a subtle dot/indicator on the status bar: "update available." |
| Sync arrives while a modal is open (settings, metadata, delete confirm) | If we replace the tree, the modal may reference a stale node. | Modal shows wrong data or crashes. | Same as above — defer sync until modal closes. |
| Sync arrives while queue eject animation is playing | Tree replacement could interrupt the physics animation. | Visual glitch. | Defer sync until animation completes (useEjectAnimation already tracks this). |
| User navigates to a node, then sync deletes that node from another tab | Current path/selectedIndex points to a node that no longer exists. | Crash or blank screen. | After applying sync, validate that `path` and `selectedIndex` still resolve to a valid node. If not, walk up the path until a valid ancestor is found. |
| Sync changes the order of siblings, shifting selectedIndex | User was looking at node at index 2, sync reorders and it's now at index 1. | Cursor jumps to wrong node. | After applying sync, re-resolve the selected node by its `id` (not index). Use `findNodeById` to get the new path + index. |

### Queue sync edges

| Situation | What happens | Risk | Mitigation |
|-----------|-------------|------|------------|
| Queue item checked off on one tab, other tab still shows it | Other tab receives sync with updated queue. | Brief stale queue display. | Broadcast queue data alongside tree data. Apply both atomically. |
| Queue references a tree node that was deleted on another tab | Queue item points to a node id that no longer exists in the tree. | Broken reference, possible crash when trying to navigate to it. | On sync, validate queue references. Remove queue items whose `refId` no longer exists in the tree. |

---

## Evaluation Plan

How to verify the feature works correctly while building it.

### Manual test matrix

Run these tests at each phase checkpoint before moving on:

| # | Test | Expected behavior | Phase |
|---|------|-------------------|-------|
| 1 | Open two tabs. Edit in tab A. Switch to tab B. | Tab B shows the edit within 1 second. No modal. | Phase 1 |
| 2 | Open two tabs. Edit in tab A while tab B is in edit mode. | Tab B shows "update available" indicator. Edit completes. On Escape, tab B updates. | Phase 1 |
| 3 | Open two tabs. Navigate to node X in tab A, delete node X from tab B. | Tab A receives sync. If tab A was viewing node X, it navigates to the nearest valid ancestor. No crash. | Phase 2 |
| 4 | Open two tabs. Rapidly alternate edits between them (10 edits in 20 seconds). | Both tabs converge to the same state. No conflict modal. No data loss. | Phase 2 |
| 5 | Open app on two different devices (or incognito window to simulate). Edit on device A. | Device B receives update via Supabase Realtime within 2-3 seconds. | Phase 3 |
| 6 | Open app. Disconnect wifi. Make edits. Reconnect. | On reconnect, pull-on-focus fetches latest server state. If server is newer (edited from another device while offline), local state is replaced. Toast shown. | Phase 3 |
| 7 | Open app. Make an edit. Check that the old ConflictModal never appears under any circumstance. | Conflict modal is gone. No code path triggers it. | Phase 2 |
| 8 | Edit a queue item on tab A. Check tab B. | Queue syncs alongside tree. | Phase 3 |

### Automated Playwright test

Add one Playwright test that opens two pages (same browser context), makes an edit in page 1, and asserts that page 2 reflects the change within 2 seconds. This covers the BroadcastChannel path. Cross-device (Supabase Realtime) is harder to automate — rely on manual testing.

### Metrics to watch post-launch

- **Conflict modal appearances: should drop to zero.** If it's not zero, there's a code path that still triggers it.
- **"Synced from another device" toast frequency.** If users see this constantly, the debounce timing may need tuning.
- **Console errors related to Realtime subscription.** Watch for `too_many_connections` or `tenant_events` errors from Supabase.

---

## Implementation Plan

### Phase 1: BroadcastChannel + defer-during-edit (same-device tabs)

**Goal:** Two tabs on the same machine stay in sync. No conflict modal.

**Changes:**
1. Create `src/hooks/useRealtimeSync.js` with BroadcastChannel logic only
2. In `App.jsx`: after a successful `saveUserTree`, call `broadcastChannel.postMessage({ type: 'tree_updated', version, tree, queue })`
3. In `useRealtimeSync`: on message received, if not in edit mode and no modal open, apply immediately. If in edit mode, set `pendingSync` and show indicator.
4. On exiting edit mode: check `pendingSync`, apply if present
5. After applying sync: re-resolve `selectedIndex` by node id using `findNodeById`

**Does NOT change:** `storage.js`, `ConflictModal` (still exists as fallback), save flow.

**Checkpoint:** Open two tabs. Edit in one. Other updates instantly. Edit while in edit mode in the other — deferred correctly. Run manual tests #1 and #2.

### Phase 2: Remove ConflictModal + silent retry on version mismatch

**Goal:** The conflict modal is gone forever. Version mismatches are handled silently.

**Changes:**
1. In `App.jsx`: change the save-failure handler. On version mismatch:
   - Fetch latest server tree + version
   - If user is NOT in edit mode: replace local state, done
   - If user IS in edit mode: store server state as pending, apply when edit exits, then re-save with the user's edit applied on top of the fresh state
2. Delete `src/components/ConflictModal.jsx`
3. Remove all conflict-related state and callbacks from `App.jsx` and `useKeyboard.js`
4. Add toast component/style for "Synced from another device"

**Checkpoint:** Open two tabs. Make conflicting saves. No modal ever appears. Run manual tests #3, #4, #7.

### Phase 3: Supabase Realtime + pull-on-focus (cross-device)

**Goal:** Two different devices stay in sync.

**Changes:**
1. In `src/storage.js`: add `subscribeToTreeChanges(userId, callback)` that sets up Supabase Realtime Postgres Changes subscription
2. In `useRealtimeSync`: add Layer 2 (Supabase Realtime) and Layer 3 (visibilitychange listener + pull-on-focus)
3. Add queue sync: broadcast and subscribe to queue changes alongside tree changes
4. On Realtime reconnect (`SUBSCRIBED` status after disconnect): pull latest as fallback
5. Ensure `user_trees` table is added to the `supabase_realtime` publication (one-time DB config)

**Checkpoint:** Open app in two different browsers (or incognito). Edit in one. Other updates within 2-3 seconds. Kill wifi, edit, reconnect — pull-on-focus works. Run manual tests #5, #6, #8. Write Playwright test for same-device sync.

### Phase 4 (optional): Queue edge cases + polish

**Goal:** Bulletproof queue sync and edge case handling.

**Changes:**
1. Validate queue references on sync — remove items pointing to deleted nodes
2. Handle "node deleted while I was viewing it" — navigate to nearest ancestor
3. Handle "siblings reordered while I was viewing them" — re-resolve by node id
4. Tune debounce timing if "synced" toasts appear too frequently
5. Add Playwright test: two-page sync within 2 seconds

**Checkpoint:** Run full manual test matrix. All 8 tests pass. No console errors. Ship it.

---

## Future Plan: Multi-User with Node-Level Mutex

This section describes the path from single-user sync to multi-user collaboration where different users edit different nodes (no concurrent editing of the same node).

### Prerequisites
- Phase 1-4 above must be shipped and stable
- Need a reason to build this (user demand, not speculation)

### Step 1: Data model migration (per-node rows)

Migrate from one JSON blob to a `nodes` table:

```sql
CREATE TABLE nodes (
  id          TEXT PRIMARY KEY,
  tree_id     UUID NOT NULL REFERENCES trees(id),
  parent_id   TEXT REFERENCES nodes(id),
  position    FLOAT NOT NULL DEFAULT 0,
  text        TEXT NOT NULL DEFAULT '',
  checked     BOOLEAN NOT NULL DEFAULT false,
  markdown    BOOLEAN NOT NULL DEFAULT false,
  deadline    TEXT,
  deadline_time TEXT,
  deadline_duration INTEGER,
  priority    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nodes_tree_id ON nodes(tree_id);
CREATE INDEX idx_nodes_parent_id ON nodes(parent_id);
```

A `trees` table replaces `user_trees` as the top-level container, with a many-to-many `tree_members` join table for sharing.

**Migration script:** Read existing `user_trees.tree_data`, recursively walk the JSON, INSERT one row per node with correct `parent_id` and `position`. Run once. Keep the old `user_trees` table as backup for 30 days.

**App changes:** Rewrite `storage.js` — `loadUserTree` becomes "SELECT all nodes, reconstruct tree." Each action in `actions.js` gets a `persist` counterpart (or use Postgres RPCs for multi-row operations like move/reorder). The in-memory tree structure stays the same — only the persistence layer changes.

### Step 2: Node-level locking via Supabase Presence

When a user enters edit mode on a node, announce it via Presence:

```javascript
channel.track({ userId, nodeId, action: 'editing' });
```

All connected clients receive the presence state. If another user tries to edit a locked node, the UI shows "Oliver is editing this" and blocks edit mode entry for that node. The lock is released when the user exits edit mode (Escape) or disconnects (Presence handles this automatically via heartbeat timeout).

**No explicit lock table needed.** Supabase Presence is ephemeral and self-cleaning — if a client disconnects, their presence state is automatically removed after the heartbeat timeout (~30 seconds).

### Step 3: Per-node Realtime sync

Subscribe to Postgres Changes on the `nodes` table filtered by `tree_id`. When any row changes, all connected clients receive the update and patch their in-memory tree.

Since different users edit different nodes (mutex), changes never conflict at the row level. LWW with `updated_at` is sufficient. No OT, no CRDT.

### Step 4: Sharing and permissions

- Add `tree_members` table: `tree_id, user_id, role (owner|editor|viewer)`
- Add RLS policies: users can only read/write nodes in trees they're members of
- Add sharing UI: invite by email, generate share link
- Add cursor/presence indicators in the tree view (colored dots showing where other users are)

### Multi-user edge cases

| Situation | Behavior |
|-----------|----------|
| User A edits node X. User B tries to edit node X. | User B sees "A is editing this" — node is read-only for B. B can edit any other node. |
| User A edits node X. User A's connection drops. | Presence heartbeat times out after ~30s. Lock is released. Other users can now edit node X. User A's unsaved edit is lost if not saved before disconnect. |
| User A deletes a parent node. User B is editing a child of that parent. | User B's node is deleted (cascade). B's edit mode is forcibly exited. B sees a toast: "The node you were editing was deleted." B is navigated to the nearest surviving ancestor. |
| User A moves node X under node Y. User B is viewing node X's old location. | B's view updates in real-time. If B had node X selected, re-resolve by node id to find its new location. |
| User A reorders siblings. User B is viewing the same parent. | B's view updates. If B had a sibling selected, re-resolve by node id. |
| Two users both try to move different nodes under the same parent simultaneously. | Both moves succeed (different rows). Position values may need rebalancing. Periodic re-index (set positions to 1, 2, 3, ...) when only one user is connected. |
| Tree has 1000+ nodes and 5 connected users. | Each node edit = 1 Postgres Changes event to 5 subscribers = 5 RLS checks. At Supabase Pro limits (500 msg/sec), this supports ~100 edits/sec across all users. More than enough. |

### What this approach does NOT support

- **Two users editing the same node's text simultaneously.** This requires character-level OT or a text CRDT (Yjs Y.Text). The mutex design explicitly forbids this. For an outliner where nodes are short bullets, this is an acceptable tradeoff.
- **Offline editing with merge.** Offline edits can't acquire locks. Bringing offline edits back online would require conflict resolution. Out of scope — require connectivity for multi-user mode.
- **Real-time cursor within a node.** Google Docs shows other users' cursors character-by-character. This requires a CRDT. The mutex model only shows "User A is editing this node," not where their cursor is.
