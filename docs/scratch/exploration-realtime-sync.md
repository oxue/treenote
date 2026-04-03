# Exploration: Real-time sync for Treenote (Google Docs-like experience)

Started: 2026-04-02
Budget: rounds:2 knowledge:2000 time:5

## Context
- Treenote uses Supabase for storage (Postgres + auth)
- Current sync: optimistic concurrency via `version` column. On conflict, user sees a modal asking "keep mine / keep theirs / keep both"
- Problem: this is confusing. User doesn't know what to choose. On two tabs/devices, they constantly hit conflicts.
- Desired: Google Docs-like — always on the most up-to-date version, no conflict modals
- Constraint: solo dev, needs to be lean. Not building a CRDT from scratch.
- Tree data structure: nested JSON (nodes with id, text, children, checked, metadata)

## Research Graph
```
ROOT: "What's the leanest way to get Google Docs-like sync for a tree-structured note app on Supabase?"
├── R1-Q1: [DONE] Supabase Realtime — Broadcast (pure relay, best fit) vs Postgres Changes (has RLS overhead)
├── R1-Q2: [DONE] Indie app patterns — "shoulder tap" + pull latest; BroadcastChannel for same-device
├── R1-Q3: [DONE] CRDT/OT/LWW — CRDTs overkill for single-user; per-node rows ideal long-term; pull-on-focus simplest
```

## Conclusion
Three-layer design: BroadcastChannel (same device) + Supabase Realtime Postgres Changes (cross device) + pull-on-focus (fallback). Delete the conflict modal entirely. Server always wins — correct for single-user. Full design in `docs/realtime-sync-design.md`.
