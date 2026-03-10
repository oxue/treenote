# Treenote Launch Plan

## What you're shipping

A keyboard-driven tree editor that stores notes as nested trees instead of flat documents. It's opinionated: no mouse needed, no rich text toolbar, no folders. You navigate laterally through a tree with arrow keys.

That opinion is the product. Don't soften it.

## Minimum bar for a Reddit launch

You don't need feature completeness. You need:

1. **It works.** Someone can sign up, make notes, close the tab, come back, and their notes are there. This is the only hard requirement.
2. **It's obvious what it is within 5 seconds.** The landing page or README gif needs to show the core interaction — navigating a tree with arrow keys, the slide animation, drilling into children. No one will read your feature list.
3. **One thing that makes someone say "oh that's cool."** The slide animation between tree levels is probably it. Or the queue eject physics. Lead with whatever gets the reaction.

What you DON'T need:
- Electron app (web-only is fine for launch)
- File import/export
- Settings modal
- Perfect mobile support
- Every keybinding working flawlessly

## Where to post

**Primary:**
- r/SideProject — most receptive, low bar, good for first feedback
- r/webdev — if you frame it as "I built this with React/Vite, here's what I learned"
- r/productivity — if you frame it as an alternative to linear note-taking

**Secondary:**
- Hacker News (Show HN) — higher bar, more critical feedback, but massive reach if it lands
- Product Hunt — good for a polished launch, not ideal for early feedback
- r/reactjs — if you want technical feedback specifically

**Post format that works:**
- Title: "I built a keyboard-only tree editor for my notes — no mouse needed"
- Body: 1-2 sentence description, a gif/video showing the core interaction, link to try it, link to GitHub
- Keep it short. People decide in 3 seconds whether to click.

## Recording the demo

A 15-20 second gif showing:
1. Start with a tree already populated (not empty state)
2. Navigate down with arrow keys (show the selection moving)
3. Drill into a node (show the slide animation)
4. Add a new node (Cmd+Down, type something, Escape)
5. Check it off (press C, show the strikethrough)

Use your existing screenshot script's approach — mock the auth, pre-populate with interesting data. Record with something like Kap or the built-in macOS screen recorder, convert to gif.

Don't narrate. Don't explain. Just show the interaction. People will ask questions if they're interested.

## What to expect

**On Reddit (r/SideProject, 50-200 upvotes):**
- 5-10 people will actually try it
- 2-3 will give genuine feedback
- Most comments will be "cool" or feature requests you don't need to build
- Someone will ask "why not just use Notion/Obsidian"

**The useful feedback you're looking for:**
- "I tried it and X didn't work" — bugs, actual UX problems
- "I wanted to do X but couldn't figure out how" — discoverability issues
- "I'd use this if it had X" — only pay attention if 3+ people say the same thing

**Feedback to ignore:**
- "Add dark mode" (you already have it)
- "Make it work on mobile" (not your target user)
- "Add folders/tags/backlinks" (that's a different product)
- Feature requests from people who didn't actually try it

## How to iterate

### Week 1-2: Fix what's broken
Only fix things that prevent the core loop from working: sign up, make notes, come back, notes are there. Nothing else.

### Week 3-4: Fix what's confusing
If multiple people couldn't figure out how to do something, that's a real signal. Usually the fix is better onboarding (the default tree's welcome text) or making the hotkey legend more visible, not new features.

### After that: Pick ONE feature
Look at what 3+ people asked for independently. Build the smallest version of it. Ship it. Post an update.

### What not to do
- Don't build features no one asked for
- Don't rebuild the architecture
- Don't add options/settings to avoid making a decision
- Don't chase a second platform (mobile, desktop) before the web version is solid
- Don't spend time on marketing before the product retains a single user for a week

## Measuring success

For a side project launch, success is not downloads or stars. It's:

1. **Does anyone come back on day 2?** If even one person uses it twice, you have something.
2. **Does anyone tell you something you didn't know?** A piece of feedback that changes how you think about the product.
3. **Did you learn something about shipping?** The launch itself is the skill. The first one is always awkward.

Star counts and upvotes are vanity metrics. Retention of even 1-2 users is the real signal.

## Pre-launch checklist

- [ ] README has a gif showing the core interaction
- [ ] Live URL works (Vercel)
- [ ] Sign up flow works (Google OAuth + email magic link)
- [ ] Default tree is welcoming and teaches the basics
- [ ] Hotkey legend is visible and accurate
- [ ] Auto-save works reliably
- [ ] Tested in Chrome and Firefox (Safari is a bonus)
- [ ] GitHub repo is public with a clean README
- [ ] You've used it yourself for at least a week with real notes

## The mindset

You're not launching a product. You're putting something in front of people to learn what matters. The goal is information, not adoption.

Every reaction — even "I don't get it" — is data. The people who don't get it tell you about your communication. The people who try it and leave tell you about your onboarding. The people who stay tell you what's actually valuable.

Ship it before you think it's ready. You'll learn more in 24 hours of real feedback than in a month of polishing.
