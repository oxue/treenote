# Exploration: How to get users for Treenote as a solo dev seeking independence

Started: 2026-04-02
Budget: rounds:3 knowledge:5000 time:15

## Context
- Treenote is a tree-structured note-taking/thinking tool
- Solo developer, can ship features fast with AI
- Near-zero users currently, developer is primary user
- Target audience unknown — maybe people who work on projects?
- Deeper goal: carve out a niche where people rely on the developer, enabling escape from corporate employment
- NOT optimizing for scale — optimizing for durable reliance from a specific group
- Question is about human actions, not features to build

## Research Graph
```
ROOT: "What concrete actions should I take to find my audience and build durable reliance?"
│
├── R1-Q1: [DONE] What indie/solo devs with similar tools are doing RIGHT NOW to get users?
│   │ Key: Reddit #1 free channel (60% of first users). Discord community-first (Obsidian playbook).
│   │ Build in public on X. Product Hunt still works with prep.
│   │
│   └──► fed into R2-Q2 (where exactly to go)
│
├── R1-Q2: [DONE] Who actually uses tree-structured thinking tools and why?
│   │ Key: Programmers, knowledge workers, writers, GTD practitioners.
│   │ Psychology: sequential/hierarchical thinkers, control seekers, zoom behavior.
│   │ Pain: terrible mobile, unreliable sync, tree becomes prison, abandonment fear.
│   │
│   └──► fed into R2-Q1 (Logseq users specifically) + R3-Q2 (positioning/story)
│
├── R1-Q3: [DONE] Current note-taking/PKM landscape
│   │ Key: OUTLINER NICHE IS UNDERSERVED. Workflowy stale, Dynalist dead, Tana pivoting,
│   │ Logseq losing users. "Outliner + AI" wide open. Specialization > generalism.
│   │
│   └──► fed into R2-Q1 (Logseq exodus) + R2-Q3 (how treenote fits in the gap)
│
├── R1-Q4: [DONE] "Durable reliance" for solo devs
│   │ Key: Sidekiq $7M/yr, Photopea $3M/yr, Carrd $2M ARR — all 1-person.
│   │ 5 mechanisms: data accumulation, integration depth, workflow muscle memory,
│   │ community effects, deliberate simplicity. Stay narrow, refuse to bloat.
│   │
│   └──► fed into R2-Q4 (economics) + R3-Q2 (philosophy of narrow focus)
│
├── R1-Q5: [DONE] Community observation
│   │ Key: Logseq exodus happening NOW. Workflowy abandoned. Tana pivoting.
│   │ Pain: tool-hopping fatigue, mobile terrible, lock-in anxiety, AI overpromised.
│   │
│   └──► fed into R2-Q1 (Logseq interception) + R2-Q2 (where to find them)
│
├── R2-Q1: [DONE] Logseq exodus interception
│   │ Key: Logseq data IS a tree (nested `- ` with indentation). Import structurally natural.
│   │ Migration thread posted YESTERDAY. Users going to Obsidian lose outliner experience.
│   │ Non-negotiables: outlining, journals, bidi links, block refs, local-first.
│   │ Challenge: treenote lacks bidi links, block refs, queries, journals.
│   │
│   └──► fed into R3-Q1 (what to do in week 1 with these users)
│
├── R2-Q2: [DONE] Specific online locations mapped
│   │ Priority ranking:
│   │   1. OutlinerSoftware.com — most concentrated outliner community, still active
│   │   2. r/Workflowy (3.3K) — every user is an outliner person
│   │   3. r/logseq (10.4K) + Logseq Discord (31.8K) — frustrated, migrating
│   │   4. r/PKMS (14.5K) — tool-comparison audience
│   │   5. Hacker News Show HN — Bike outliner got 513 points
│   │   6. PKM Weekly newsletter — pitch Ed Nico for coverage
│   │   7. r/ObsidianMD (108.7K) + Obsidian Discord (180.3K) — largest, strictest rules
│   │
│   └──► fed into R3-Q1 (concrete action plan) + R3-Q3 (what makes a good launch post)
│
├── R2-Q3: [DONE] Treenote honest assessment
│   │ Unique: lateral 3-column navigation (no other outliner does this), keyboard-only,
│   │ queue + physics eject, deliberate simplicity.
│   │ Missing: search, try-without-signup, export, offline, onboarding, demo.
│   │ Pitch: "Keyboard-only outliner where you navigate laterally through a tree"
│   │ Critical before launch: search, try-without-signup, demo gif.
│   │
│   └──► fed into R3-Q1 (what to build before going public) + R3-Q2 (positioning)
│
├── R2-Q4: [DONE] Independence economics
│   │ Target: 1,500-2,000 paying users × $8-10/mo = $150-200K/yr
│   │ Infrastructure: ~$200-500/mo (95%+ margins for text-based tool)
│   │ Go paid-only or free trial, NOT freemium (2-5% conversion too low for solo dev)
│   │ Timeline: 12-24 months to $15K MRR realistically
│   │ Risk: distribution is the hard part, not building
│   │
│   └──► fed into R3-Q1 (pricing strategy in the action plan)
│
├── R3-Q1: [DONE] Concrete 60-day action plan
│   │ Week-by-week: build search→demo mode→Logseq import→onboarding→Stripe→Show HN
│   │ Key discipline: build ONLY what unblocks the next distribution move
│   │ Day 60 target: 500-800 signups, 80-150 weekly actives, 20-40 paying users
│   │
│   └──► synthesized from ALL prior rounds
│
├── R3-Q2: [DONE] Positioning and brand story
│   │ Headline: "One tree. No noise." or "Think in trees, not tabs."
│   │ Voice: direct not clever, confident removal, first-person singular, anti-productivity-porn
│   │ Key line: "These are not missing features. They are decisions."
│   │ Philosophy: Pinboard/Bear model — solo dev is the brand, not a weakness
│   │
│   └──► informed by R1-Q4 (durable reliance), R2-Q3 (honest assessment)
│
└── R3-Q3: [DONE] Best launch post analysis
    │ Obsidian Show HN: 1,087 pts — title was the entire pitch ("local Markdown files")
    │ Bike Show HN: 513 pts — one differentiator (fluid editing) + open formats + honest founder
    │ Workflowy: 172 pts — 45-sec video was everything, but requiring signup killed conversions
    │ Logseq: 65 pts — "X but open-source" is weak positioning
    │ Pattern: value-prop title + one differentiator + zero-friction try + founder in comments
    │ Warning: HN hates subscription pricing for local tools
    │
    └──► informs Show HN strategy in R3-Q1 action plan
```

## Round 1 Synthesis

### Three big signals emerged:

**1. The outliner niche has a power vacuum RIGHT NOW.**
Workflowy is stale (community feels abandoned, no AI, no smart features). Dynalist is explicitly dead (founders moved to Obsidian). Logseq is in active crisis — stalled database rewrite, sync failures, data loss, users actively posting migration guides to Obsidian. Tana is pivoting away from outliners toward enterprise. On GitHub, there is no well-starred, actively-maintained, mobile-capable tree-structured note app. The outliner niche is emptying out while the broader PKM market triples to $24B by 2032.

**2. There is a wave of displaced users with nowhere good to go.**
Logseq users are migrating, but their destination is Obsidian — which is a graph/vault tool, not a true outliner. They're settling, not choosing. Workflowy users want something that hasn't stagnated. These users are in-market RIGHT NOW, actively looking for alternatives and posting about it in forums.

**3. The proven acquisition playbook is community-first + Reddit.**
Reddit is the #1 free acquisition channel for indie devs (multiple case studies: 60% of first users). The Obsidian playbook (Discord community, early adopters as moderators, build in public) went from 0 to 10K Discord members in 6 months. Build in public on X/Twitter attracts other builders who become evangelists.

---

## Round 2 Synthesis

### Four things clarified:

**1. The Logseq interception is viable but scoped.**
Logseq's data format is literally a nested tree — import is structurally natural. A migration thread was posted YESTERDAY. But Logseq power users need bidi links, block references, and queries that treenote doesn't have. The opportunity is the SIMPLER Logseq users — people who used it as an outliner and never went deep on queries/block refs. They just want a tree that works with reliable sync.

**2. The locations are mapped and prioritized.**
OutlinerSoftware.com is the #1 target (most concentrated outliner enthusiasts). Then r/Workflowy, r/logseq, r/PKMS. Hacker News Show HN is high-risk/high-reward (Bike outliner got 513 points). PKM Weekly newsletter is a warm pitch.

**3. Treenote's differentiator is the lateral navigation model.**
No other outliner shows parent-current-children as three columns with drill-in animation. This is genuinely unique and visually distinctive — perfect for a demo gif. But 3 things must ship before going public: search, try-without-signup, demo gif.

**4. The economics work at modest scale.**
1,500 paying users at $8-10/month = independence. Text-based tools have 95%+ margins. Paid-only or free trial, not freemium. This is achievable in 12-24 months IF distribution works.

### Remaining gaps for Round 3:

1. We need a **concrete sequenced action plan** — what to do in week 1, month 1, month 2. Combining the "what to build first" from R2-Q3 with "where to go" from R2-Q2.
2. We need the **story/positioning** — not just "what it does" but "why it exists." The user mentioned philosophy, freedom from corporate, carving out a piece of the internet. How does that translate into a brand?
3. We need to study **what actually works in launch posts** — look at the Bike HN post (513 points), successful Reddit launches, to understand the format and tone.

---

## Round 3
### Questions
- R3-Q1: Synthesize everything into a concrete 60-day action plan. What to build (minimal), where to post (sequenced), what to say. Week-by-week. (SYNTHESIS — uses all prior rounds)
- R3-Q2: How should treenote position itself? What's the story, the philosophy, the brand voice? Research how successful solo dev tools present themselves. (SEARCH + OBSERVE)
- R3-Q3: Go look at the actual best launch posts for tools like this — the Bike Show HN, successful Reddit launches for PKM tools. What specifically did they say and why did it work? (OBSERVE)

## Round 3 Synthesis

**The action plan is concrete and sequenced.** Three phases over 60 days:
- Weeks 1-3: make it showable (search, demo mode, Logseq import, demo gif)
- Weeks 4-6: soft launch to niche communities (OutlinerSoftware → r/Workflowy → r/logseq → r/PKMS)
- Weeks 7-8.5: add pricing, polish, Show HN

**The positioning is clear.** "One tree. No noise." Define treenote by what it removes, not what it adds. The solo dev is the brand. The anti-bloat philosophy is the differentiation. Never say "second brain."

**The launch post playbook is proven.** Title = value proposition (not description). One strong differentiator. Zero-friction try path. Founder answers every comment for 4 hours. HN hates subscriptions for local tools — consider one-time purchase or free+paid-sync model.

**One pricing tension surfaced:** The economics research says $8-10/month subscription. The launch post research says HN users hate subscription pricing for note tools. Resolution: offer $79/year (annual billing feels less SaaS-y) with a free demo mode and 14-day trial. Or consider the Obsidian model (core free, sync is the paid feature).

---

## Final Synthesis

### The Situation

You are a solo developer building a tree-structured outliner with a genuinely unique interaction model (lateral 3-column navigation). The outliner niche is experiencing a once-in-a-decade power vacuum: Workflowy is stale, Dynalist is dead, Logseq is in active exodus, and Tana is pivoting to enterprise. There is a wave of displaced users settling for Obsidian — which is not an outliner — because nothing better exists. The broader PKM market is projected to triple to $24B by 2032.

Your tool has a clear differentiator (the lateral navigation) but is not yet ready for strangers (missing search, demo mode, export). The economics work at modest scale: 1,500 paying users at $8-10/month = $150-200K/year with 95%+ margins.

### The Strategy (Ordered by Strength of Signal)

**1. Ship the three blockers, then go to the communities. (Highest confidence)**

Evidence: Every successful launch post required zero-friction try. Workflowy's biggest criticism was requiring signup. Obsidian's launch was download-and-go. R2-Q3 identified search, demo mode, and a demo gif as the three things between treenote and being showable. This is ~2-3 weeks of work with AI-assisted development.

Actions:
- Week 1: Ship search + record demo gif
- Week 2: Ship try-without-signup (localStorage demo mode)
- Week 3: Ship OPML export + Logseq markdown import

**2. Start at OutlinerSoftware.com and r/Workflowy, not Hacker News. (High confidence)**

Evidence: R2-Q2 mapped the communities. OutlinerSoftware.com is the most concentrated gathering of outliner enthusiasts on the internet — they discuss new outliners for decades. r/Workflowy has 3.3K members who are ALL outliner users. These are small ponds where a genuine introduction will be seen by exactly the right people. HN is high-risk/high-reward and should come later (week 8) after you've incorporated early feedback.

Actions:
- Weeks 1-3: Create accounts, lurk, answer questions (zero self-promotion)
- Week 4: Post genuine introduction on OutlinerSoftware.com + r/Workflowy
- Week 5: Post on r/logseq targeting migrating users
- Week 6: Post on r/PKMS
- Week 8: Show HN

**3. Position as anti-bloat, not as a feature set. (High confidence)**

Evidence: R3-Q2 found that every successful solo dev tool (Pinboard, Bear, Carrd, Workflowy, Bike) positions on what it removes, not what it adds. Users report spending "43 hours picking a damn note-taking app" and "more time configuring than writing." The 37signals "build less" philosophy is proven. Treenote's deliberate simplicity is a feature.

Positioning:
- Headline: "One tree. No noise." or "Think in trees, not tabs."
- Voice: direct, first-person, anti-productivity-porn
- Key copy: "These are not missing features. They are decisions."
- Never say: "second brain," "knowledge management," "personal wiki"

**4. Intercept the Logseq exodus — but target simple users, not power users. (Medium-high confidence)**

Evidence: R2-Q1 found Logseq's data format is literally a nested tree — import is structurally natural. A migration thread was posted April 1, 2026 (yesterday). But Logseq power users need bidi links, block references, queries — features treenote doesn't have and shouldn't rush to build (that's the Notion trap). The opportunity is the simpler Logseq users who just want a tree that syncs.

Actions:
- Week 3: Build Logseq markdown import (just the tree structure, not block refs)
- Week 5: Post on r/logseq: "For those who used Logseq as an outliner — here's a lightweight alternative with one-click import"

**5. Price at $9/month or $79/year with a permanent free demo mode. (Medium confidence)**

Evidence: R2-Q4 says 1,500 users at $8-10/month = independence. R3-Q3 says HN hates subscriptions for local tools. Resolution: demo mode (localStorage, free forever) + cloud sync as the paid feature (the Obsidian model). This gives zero-friction try, clear value for payment (sync = the thing you can't do yourself), and avoids the "why am I paying for a note app" objection.

Actions:
- Week 7: Integrate Stripe. 14-day trial, then $9/month or $79/year.
- Grandfather all pre-payment users with 90 days free.

**6. Build in public on X/Twitter from day 1. (Medium confidence)**

Evidence: R1-Q1 found multiple 2025-2026 case studies where build-in-public was a primary growth channel. Cameron Trew hit $62K MRR with "deep user feedback loops and smart distribution through trusted networks" and no paid ads. The solo dev's story IS the marketing — Pieter Levels' CAC is near zero because his narrative is the product.

Actions:
- Week 1: First X post — screen recording of lateral navigation
- Weekly: progress update with real numbers (signups, actives, revenue)
- Share both wins and failures

### What NOT To Do

1. **Don't build bidi links, block references, or queries.** That's the Notion trap — chasing power users into feature sprawl. Stay narrow. The users who need those features are not your users.
2. **Don't launch on Product Hunt first.** PH requires 2-4 weeks of prep and is less targeted than outliner communities. Save it for month 3-4.
3. **Don't go freemium.** Freemium converts 2-5% and free users are expensive. A permanent demo mode + paid sync is different — the demo is a try-before-you-buy, not a forever tier.
4. **Don't call it a "second brain" or "PKM tool."** That's a crowded, exhausted category. "Outliner" is specific and underserved.

### The Numbers

| Milestone | Target | When |
|-----------|--------|------|
| Showable product | Search + demo mode + export | Week 3 |
| First strangers | 30-50 signups | Week 4 |
| Soft launch | 150-200 signups, 30-50 weekly actives | Week 6 |
| First revenue | 5-10 paying users | Week 7 |
| Show HN | 500-800 signups, 20-40 paying | Week 8-9 |
| Independence ($15K MRR) | 1,500-2,000 paying users | Month 12-24 |
