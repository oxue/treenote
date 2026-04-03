# iPhone Widget for Treenote — Scoping Document

*Created: 2026-03-14*

## Current State

Treenote is a React + Vite web app with an Electron desktop wrapper. Data is stored in Supabase (auth + postgres). There is no native mobile app of any kind today.

## What an iPhone Widget Actually Requires

iOS widgets can **only** be built as extensions of a native iOS app. There is no way to create a standalone widget — Apple requires a host app. This means the full chain is:

**Web app → Native iOS app → Widget Extension**

---

## Step-by-Step: What You Have to Do

### 1. Apple Developer Program Enrollment

- **What**: Sign up at [developer.apple.com](https://developer.apple.com/programs/)
- **Cost**: **$99/year** (individual). Required to distribute on App Store or TestFlight.
- **Time**: Approval is usually instant for individuals, but can take a few days if Apple needs to verify identity.
- **Note**: You can develop and test on your own device with a free Apple ID, but you cannot distribute to others or publish widgets without the paid membership.

### 2. Install Xcode

- **What**: Download Xcode from the Mac App Store (free).
- **Size**: ~35 GB download, needs ~50 GB disk space.
- **Requires**: macOS (you're on Darwin, so you're good).
- **Time**: Download + install takes 30–60 min depending on internet speed.

### 3. Build a Native iOS App (the Host App)

This is the big one. You need an actual iOS app that Apple will approve. Options:

#### Option A: Full Native Swift App (Hardest, Best Result)
- Rewrite or port the Treenote UI in SwiftUI.
- Directly talk to Supabase via the [Supabase Swift SDK](https://github.com/supabase/supabase-swift).
- **Effort**: Weeks to months depending on feature parity. You'd need to learn Swift/SwiftUI if you don't know it.
- **Pros**: Best performance, best widget integration, native feel.

#### Option B: React Native / Expo Wrapper (Medium)
- Wrap your existing React code in React Native or use Expo.
- Your current React code is DOM-based so it won't just drop in — components would need to be rewritten for React Native primitives (`View`, `Text`, etc.).
- **Effort**: Weeks. Significant rewrite of UI layer, but business logic and Supabase calls can be reused.
- **Pros**: Shared JS ecosystem, one codebase for iOS + Android eventually.
- **Cons**: Widget extensions still need to be written in Swift (React Native can't render widgets). So you'd have a hybrid: RN app + Swift widget.

#### Option C: Capacitor/Ionic WebView Wrapper (Easiest for App, Hardest for Widget)
- Wrap your existing Vite web app in a WebView using [Capacitor](https://capacitorjs.com/).
- Your existing code runs almost as-is inside a native shell.
- **Effort**: Days to get the app wrapper working. But...
- **Cons**: Widgets **cannot** be WebViews. Apple requires widgets to be built with SwiftUI/WidgetKit. So you'd still need to write the widget in Swift separately. The "easy" wrapper doesn't help with the widget part.

#### Option D: PWA + Shortcuts (No Widget, but Closest Shortcut)
- Skip the native app entirely. Make Treenote a Progressive Web App (add a manifest, service worker).
- Users can "Add to Home Screen" from Safari.
- **No widget possible**, but it gives a home screen icon and offline capability.
- **Effort**: 1–2 days.
- **Cons**: No widget. No App Store presence. Limited iOS integration.

### 4. Build the Widget Extension (WidgetKit)

Regardless of which app option you choose (A, B, or C), the widget itself must be:
- Written in **Swift** using **WidgetKit** and **SwiftUI**.
- Part of the Xcode project as a "Widget Extension" target.
- Widgets are **not interactive apps** — they display data and can deep-link into the app on tap.
- Widgets refresh on a timeline (you request refresh intervals; iOS decides when to actually refresh — could be every 5 min to every hour).

**What a Treenote widget might show**:
- The current focused node and its children (read-only snapshot).
- A "quick capture" button that deep-links into the app for input.
- Queue items or a daily focus node.

**Widget data access**:
- The widget runs in a separate process from the app. They share data via an **App Group** (shared UserDefaults or shared file container).
- The app writes tree data to the shared container; the widget reads it.
- Alternatively, the widget could fetch directly from Supabase, but this is slower and uses battery.

### 5. App Store Submission

- **What**: Submit the app + widget for Apple's review.
- **Time**: Review typically takes 24–48 hours. First submissions sometimes take longer or get rejected for minor issues (missing privacy policy, screenshots, etc.).
- **Requirements**: App Store listing needs screenshots, description, privacy policy URL, app icon in various sizes.
- **Ongoing**: Every update goes through review. Apple can reject updates.

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $99 | Annual |
| Xcode | Free | — |
| Mac (you have one) | $0 | — |
| iPhone for testing | ~$0 if you have one; Simulator works for most dev | — |
| App Store hosting | Included in $99 | — |
| **Total minimum** | **$99/year** | |

No per-download fees unless you charge for the app (Apple takes 30% of paid apps/IAP).

---

## Effort Estimate

| Phase | Optimistic | Realistic | Notes |
|-------|-----------|-----------|-------|
| Apple Developer enrollment + Xcode setup | 1 day | 2 days | Mostly waiting |
| Learn Swift/SwiftUI basics (if new) | 3 days | 1–2 weeks | Depends on prior experience |
| Build minimal iOS app (Capacitor route) | 2–3 days | 1 week | Wrapping existing web app |
| Build minimal iOS app (native SwiftUI) | 2–3 weeks | 1–2 months | Depends on feature scope |
| Build widget extension | 3–5 days | 1–2 weeks | SwiftUI + WidgetKit + data sharing |
| App Store submission + iteration | 2–3 days | 1 week | First submission usually has back-and-forth |
| **Total (Capacitor app + Swift widget)** | **~2 weeks** | **~1 month** | Fastest path to widget |
| **Total (native SwiftUI app + widget)** | **~1 month** | **~2–3 months** | Best long-term path |

---

## Recommended Path

**If the goal is specifically an iPhone widget with minimum effort:**

1. **Capacitor** to wrap the existing web app as the host iOS app (days, not weeks).
2. **Swift/WidgetKit** for the widget extension itself (unavoidable — must be native).
3. Shared data via **App Group**: the web app (inside Capacitor) writes tree state to shared storage using a Capacitor plugin; the widget reads it.

This gets you to a working widget in ~2–4 weeks with the least new code, but it's a bit of a Frankenstein (WebView app + native widget). If you want to eventually have a proper native iOS experience, starting with Option A (SwiftUI) is better long-term.

**If the goal is just "Treenote on my phone":**

Skip the widget entirely. Make it a PWA (Progressive Web App) — it'll work from the home screen and you can do it in a day or two. Add the widget later if there's demand.

---

## Key Risks

- **Apple rejection**: Apple sometimes rejects WebView-only apps that don't add enough native functionality beyond what the website offers. Having a widget helps justify the native app's existence.
- **Widget limitations**: Widgets are read-only snapshots, not mini-apps. Users can't type or interact beyond tapping to open the app. If your friend imagines editing the tree from the widget, that's not possible.
- **Maintenance burden**: Now you have a web app, an Electron app, AND an iOS app to maintain. Three deployment targets for one product.
- **Swift learning curve**: The widget must be Swift. No way around it. If you've never written Swift, budget time for learning.
