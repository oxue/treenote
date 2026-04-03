# Mobile App — Area Doc

## Design Philosophy

The mobile app is a **separate component tree** from the desktop app, not a responsive variant. `main.jsx` routes to either `App.jsx` (desktop) or `MobileApp.jsx` (mobile) based on `Capacitor.isNativePlatform()` or `?mobile=true` URL param. They share the same backend (Supabase), storage functions, and `actions.js` tree utilities, but have completely independent UI.

Key constraint: `actions.js` functions like `ensureIds()` mutate in place and return `undefined` — never assign their return value.

## Module Structure

```
src/
  main.jsx              — Routes to App or MobileApp based on mobile detection
  MobileApp.jsx         — Root mobile component: state, data loading, tab routing, action handlers
  MobileApp.css         — Tab bar, action sheet, layout
  components/mobile/
    MobileTreeScreen     — Single-column drill-in tree view with breadcrumb, swipe actions
    MobileQueueScreen    — Horizontal card pager with swipe gestures
    MobileSettingsScreen — iOS-style grouped settings list
    MobileEditScreen     — Full-screen slide-up editor for text + metadata
```

## State Ownership

All state lives in `MobileApp.jsx`. Screen components are presentational — they receive data and callbacks as props. This mirrors the desktop `App.jsx` pattern.

- `tree` / `queue` / `version` — data from Supabase
- `tab` — which screen is active ('tree' | 'queue' | 'settings')
- `treePath` — array of indices for current drill-in position
- `editTarget` / `editVisible` — what's being edited
- `actionMenu` — long-press action sheet state

## Data Flow

1. **Load**: `loadUserTree` + `loadUserQueue` on mount
2. **Save**: `saveTree()` / `saveQueue()` after every mutation (auto-save, no manual save needed)
3. **Widget sync**: `useEffect` writes queue snapshot to App Group via `capacitor-widget-bridge` on every `[queue, tree]` change
4. **Settings**: `useSettings()` hook (shared with desktop)

## Capacitor / iOS Integration

- **Config**: `capacitor.config.json` in project root
- **iOS project**: `ios/App/` — Capacitor-managed Xcode project
- **Widget extension**: `ios/App/TreenoteWidget/` — native SwiftUI widget reading from App Group `group.zenica.treenotequeue`
- **OAuth**: Uses `@capacitor/browser` to open Google sign-in in system browser, redirects back via `zenica.treenotequeue://` URL scheme
- **Build pipeline**: `npm run build && npx cap sync ios` then Cmd+R in Xcode

## Rules for Modifying

1. **Never import desktop components** into mobile or vice versa. Shared code goes in `actions.js`, `storage.js`, `hooks/`, or `supabaseClient.js`.
2. **Screen components get props, not context/state**. All state management stays in `MobileApp.jsx`.
3. **After adding a new screen**: add a tab in the tab bar and a routing condition in `MobileApp.jsx`.
4. **After changing the queue data shape**: update both the JS widget sync in `MobileApp.jsx` AND the Swift `QueueWidgetItem` struct in `TreenoteWidget.swift`.
5. **Test mobile changes** in browser with `?mobile=true` before building for iOS.
6. **Simulator emoji bug**: Use iOS 26.1 simulator, not 26.3 (emojis render as question mark boxes on 26.3).
