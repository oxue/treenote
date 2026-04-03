# Treenote Queue — iPhone App + Widget (v2 Scope)

*Created: 2026-03-14*

## Concept

Instead of porting the full Treenote app to iOS, build a focused companion app: **"Treenote Queue"**. It only shows the queue — a flat list of items the user has queued from the main web/desktop app. This keeps the scope small enough for a native SwiftUI app with a real widget.

### Features

**App:**
- View queue items (both `ref` items linked to tree nodes and standalone `temp` items)
- Edit item text inline
- Add new standalone queue items
- Remove / check off items
- Search the full tree to add nodes to the queue as `ref` items
- Supabase auth (sign in with same account as web app)

**Widget:**
- Small/medium widget showing the top N queue items
- Tap an item to open the app to that item
- Tap the widget header to open the app

---

## Data Model (Current)

Queue is stored in Supabase in the `user_trees` table, column `queue_data` (JSONB array).

Each queue item is one of:
```json
{ "type": "ref", "nodeId": "abc-123", "checked": false }
{ "type": "temp", "text": "Buy groceries", "checked": false }
```

For `ref` items, the display text, deadline, and priority are resolved from the tree at render time. The tree itself is stored in the `tree_data` column of the same row.

**Implication for the iOS app**: To display `ref` items and to power the "search tree to add to queue" feature, the app needs read access to `tree_data` too — not just `queue_data`.

---

## Steps

### Step 0: Prerequisites

| Task | Details | Time |
|------|---------|------|
| Enroll in Apple Developer Program | [developer.apple.com/programs](https://developer.apple.com/programs/), $99/year. Required to distribute via TestFlight or App Store. | 1–3 days (usually instant, sometimes identity verification) |
| Install Xcode | Free from Mac App Store. ~35 GB download, ~50 GB disk. You're on macOS so this is fine. | 30–60 min |
| Get an iPhone or use Simulator | Simulator works for most development. You need a physical device for widget testing (Simulator supports widgets but can be flaky). | — |

**Cost: $99/year. Everything else is free.**

### Step 1: Xcode Project Setup

- Create a new Xcode project: **App** template, SwiftUI, Swift.
- Bundle ID: `com.treenote.queue` (or similar).
- Add the **Supabase Swift SDK** via Swift Package Manager: `https://github.com/supabase/supabase-swift`.
- Set up an App Group (e.g., `group.com.treenote.queue`) — this is how the app and widget share data. Do this now even though you won't use it until the widget step.
- Target iOS 17+ (WidgetKit interactive features require iOS 17).

**Deliverable**: Empty app that builds and runs on Simulator.

### Step 2: Supabase Auth

- Use the Supabase Swift SDK's `Auth` module.
- Implement "Sign in with email/password" (or whatever auth methods your Supabase project supports — check your current auth config).
- On sign-in, store the session. The Supabase Swift SDK handles token refresh automatically.
- Store the user ID for subsequent API calls.

**Key detail**: Your Supabase anon key and URL are already in `.env` / the web app. The Swift app needs the same values hardcoded or in a config file (these are public values, safe to bundle).

**Deliverable**: User can sign in and see their user ID.

### Step 3: Fetch and Display the Queue

- Call Supabase: `SELECT queue_data, tree_data FROM user_trees WHERE user_id = ?`.
- Parse `queue_data` JSON array into Swift structs:
  ```swift
  struct QueueItem: Codable, Identifiable {
      let id: UUID  // generate client-side for list identity
      let type: String  // "ref" or "temp"
      var text: String?
      var nodeId: String?
      var checked: Bool
  }
  ```
- For `ref` items, walk the `tree_data` JSON to find the node by `nodeId` and resolve its `text`, `deadline`, `priority`.
- Display as a SwiftUI `List` — each row shows the item text, checked state, deadline badge, priority badge.

**Deliverable**: App shows the user's queue after sign-in, matching what the web app shows.

### Step 4: Queue Mutations

Implement these interactions:

| Action | UI | Backend |
|--------|-----|---------|
| Check/uncheck item | Tap checkbox | For `ref` items: update `checked` on the tree node in `tree_data`. For `temp` items: update `checked` in `queue_data`. Save both columns. |
| Edit item text | Tap item → inline text field | For `ref` items: update `text` on the tree node. For `temp` items: update `text` in queue item. Save. |
| Delete item | Swipe to delete | Remove from `queue_data` array. Save. |
| Reorder items | Drag to reorder | Reorder `queue_data` array. Save. |
| Add standalone item | "+" button → text field | Append `{ type: "temp", text: "...", checked: false }` to `queue_data`. Save. |

**Concurrency**: The web app uses a `version` column for optimistic concurrency. The iOS app should too — read the version on fetch, send it on save, handle conflicts (simplest: last-write-wins with a "your data was updated elsewhere, reload?" prompt).

**Deliverable**: Full CRUD on queue items, synced to Supabase.

### Step 5: Search Tree to Add Ref Items

- Parse `tree_data` (the full tree JSON) into a flat list of nodes with their text.
- Present a search bar that filters nodes by text.
- On selection, append `{ type: "ref", nodeId: "<selected node's id>" }` to `queue_data` and save.
- This mirrors the web app's `q` keybinding which sends a tree node to the queue.

**Deliverable**: User can search their tree and add nodes to the queue.

### Step 6: Widget Extension

- Add a **Widget Extension** target in Xcode (File → New → Target → Widget Extension).
- The widget reads queue data from the **App Group shared container** (not directly from Supabase — widgets have limited runtime and network budget).
- The app writes a snapshot of the queue to the shared container (`UserDefaults(suiteName: "group.com.treenote.queue")`) whenever queue data changes or the app enters background.

**Widget sizes**:
- **Small** (`.systemSmall`): Show top 3 queue items (text only, truncated).
- **Medium** (`.systemMedium`): Show top 5–6 items with checked state and deadline.

**Interactivity** (iOS 17+):
- Tap any item → deep link opens the app to that item.
- Optionally: toggle checkbox directly from widget using `AppIntent` (iOS 17 interactive widgets).

**Timeline**: Request refresh every 30 minutes. Also trigger a timeline reload from the app whenever queue data changes (`WidgetCenter.shared.reloadAllTimelines()`).

**Deliverable**: Working widget on home screen showing queue items.

### Step 7: Polish and App Store Prep

- App icon (1024x1024 PNG, no alpha).
- Launch screen.
- Privacy policy page (required — can be a simple static webpage, e.g., a GitHub Pages site).
- App Store screenshots (iPhone 6.7" and 6.1" required at minimum).
- App Store description and metadata.
- Test on physical device.
- Archive and upload via Xcode Organizer.

### Step 8: TestFlight / App Store Submission

- **TestFlight first**: Upload a build, invite your friend (and yourself) as testers. No review needed for internal testers (up to 100 people). This is the fastest way to get it on a real phone.
- **App Store submission**: Submit for review when ready. First review typically 24–48 hours. Common first-submission rejections:
  - Missing privacy policy URL
  - Screenshots don't match app
  - App is "too simple" (unlikely with queue + widget + search — that's enough substance)

---

## Effort Estimate

| Step | Optimistic | Realistic | Notes |
|------|-----------|-----------|-------|
| 0. Prerequisites | 1 day | 3 days | Mostly waiting for Apple |
| 1. Xcode project setup | 2 hours | half day | Boilerplate |
| 2. Supabase auth | 1 day | 2 days | SDK does the heavy lifting |
| 3. Fetch and display queue | 1–2 days | 3 days | JSON parsing + tree walking |
| 4. Queue mutations | 2–3 days | 1 week | CRUD + concurrency handling |
| 5. Search tree | 1 day | 2 days | Straightforward filter |
| 6. Widget | 2–3 days | 1 week | WidgetKit + App Group + deep links |
| 7. Polish + App Store prep | 1–2 days | 3 days | Icons, screenshots, privacy policy |
| 8. TestFlight / submission | 1 day | 3 days | Review wait time |
| **Total** | **~2 weeks** | **~4–5 weeks** | |

Add 1–2 weeks if you're learning Swift/SwiftUI from scratch.

---

## Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Everything else | Free | — |

---

## Key Decisions to Make Before Starting

1. **Auth method**: Does your Supabase project use email/password, magic link, OAuth (Google/GitHub), or multiple? The iOS app needs to support the same method(s). Check your Supabase auth config.

2. **Write conflicts**: When the iOS app and web app both modify the queue, what happens? Options:
   - Last-write-wins (simplest, some data loss risk)
   - Version check with "reload" prompt (safer, more code)
   - Real-time sync via Supabase Realtime (best UX, most work)

3. **Ref item edits**: When you edit a `ref` queue item's text in the iOS app, you're actually editing a tree node. This means the iOS app writes to `tree_data`. Is that acceptable, or should `ref` items be read-only on mobile?

4. **Separate repo or monorepo?**: The iOS app is a completely separate Xcode project (Swift, not JS). It could live in an `ios/` folder in this repo or in its own repo. Monorepo is simpler for one developer.

---

## Risks

- **Tree data format changes**: If the web app changes the tree JSON structure, the iOS app's parser breaks. Need to keep them in sync.
- **Supabase Swift SDK maturity**: The SDK is maintained but newer than the JS SDK. May hit edge cases.
- **Widget refresh limits**: iOS throttles widget refreshes aggressively. The widget may show stale data for minutes after a change.
- **Scope creep**: "Just the queue" will inevitably lead to "can I also see the tree?" — decide the boundary up front.
