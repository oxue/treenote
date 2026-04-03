# Exploration — Area of Concern

## Design Philosophy
Exploration is a mode of working in chat, not a code module. The goal is to diverge first (cast a wide net, gather information, surface options) and then converge (synthesize findings, narrow to decisions). This mirrors double-diamond design thinking: open up before closing down.

The key principle: **don't be lazy**. For strategic questions ("how do I get users?", "what should I build next?", "what's the competitive landscape?"), a quick pattern-matched answer from training data is low-signal. High-signal answers require multiple rounds of real research where each round's findings inform the next round's questions.

## When to Use
When the user says "let's explore" or "research this" or asks a strategic/open-ended question that can't be answered well in a single pass. The signal is that the user would rather wait 20 minutes for a high-signal answer than get a generic one in 30 seconds.

## Architecture

### Constraint
Sub-agents cannot spawn sub-agents. Only one level of depth is available. This means the **main agent is the orchestrator loop** — it runs the research graph, synthesizes between rounds, and decides what to explore next.

### Research Graph
The accumulated knowledge lives in a **scratch file** at `docs/scratch/exploration-{topic}.md`, NOT in the main agent's context window (which gets compressed over long conversations). Each round, the main agent:
1. Reads the scratch file to recall all prior findings
2. Decides what to explore next
3. Spawns parallel sub-agents (shallow, one-shot)
4. Collects results and appends them to the scratch file
5. Writes a synthesis section at the end of the scratch file

This means the research state survives context compression. The scratch file IS the graph.

### Scratch File Format
```markdown
# Exploration: {topic}
Started: {timestamp}
Budget: rounds:{N} knowledge:{N} time:{N}

## Round 1
### Questions
- Q1: ...
- Q2: ...

### Findings
#### Q1: {sub-question}
{agent findings, 800-1500 words}

#### Q2: {sub-question}
{agent findings}

### Round 1 Synthesis
{what we learned, what patterns emerged, what gaps remain}

## Round 2
### Questions (informed by Round 1 gaps)
...

## Final Synthesis
{structured, actionable deliverable}
```

## Budget Parameters

Three knobs control how much work the exploration does. All three are enforced — the exploration continues until ALL three minimums are met.

| Parameter | What it controls | Default | Override syntax |
|-----------|-----------------|---------|-----------------|
| **rounds** | Number of research-then-synthesize cycles | 3 | `rounds:5` |
| **knowledge** | Minimum words of sub-problem research generated across all sub-agents before final synthesis | 5000 | `knowledge:10000` |
| **time** | Minimum wall-clock minutes to spend (forces the system to keep digging instead of converging early) | 10 | `time:20` |

The user can override any parameter inline, e.g.: "explore how to get more users, time:20 rounds:4"

These are **minimums**, not caps. If round 3 surfaces a promising new thread and the time budget isn't exhausted, keep going. Converge only when: (a) all three minimums are met, AND (b) research has stopped yielding new signal.

## Protocol

### Round 1 — Decompose and Fan Out
1. Break the user's question into 4-6 sub-questions from different angles (market, technical, competitive, user psychology, timing, etc.). Use multi-perspective question generation — ask "what would a marketer ask? a user? a competitor? a journalist?"
2. Spawn parallel sub-agents, each doing web research on one sub-question. Each agent should search broadly, follow links, and write up findings (not just return search snippets).
3. Present a brief summary of what was dispatched so the user knows what's being explored.

### Round 2+ — Synthesize and Deepen
1. Read the scratch file to get full context from all prior rounds.
2. Synthesize: what did we learn? What patterns emerged? What's surprising?
3. Identify gaps: what questions did round N raise that round N didn't answer?
4. Fan out again on the gaps and follow-up questions.
5. Append new findings and synthesis to the scratch file.
6. Repeat until budget is met and signal is diminishing.

### Final — Converge
1. Read the full scratch file.
2. Synthesize ALL findings across ALL rounds into a structured deliverable.
3. This should be **specific and actionable**, not generic advice. Include names, links, numbers, examples found during research.
4. Organize by strength of signal (what has the most evidence behind it) not by topic.
5. Flag what's uncertain or needs validation.
6. Append final synthesis to the scratch file for future reference.

## Two Modes of Sub-Agent Research

Sub-agents should do two distinct types of work:

### 1. Search (find answers)
Traditional information retrieval — search for articles, guides, case studies that answer the sub-question. Good for "what strategies work for X" type questions.

### 2. Observe (look at the world)
Go to specific places on the internet and **report what you see**, not what you were looking for. This is ethnographic, not search-driven. Examples:
- "Go to the Indie Hackers front page and tell me what the top 10 posts are about right now"
- "Look at the top 20 note-taking apps on Product Hunt from the last 3 months and describe their positioning"
- "Go to r/productivity and r/NoteTaking and tell me what people are actually complaining about this week"
- "Find 5 solo developer products that seem to have traction and describe how they present themselves"

Observation produces **primary data** (what's actually happening right now) vs search which produces **secondary data** (what someone wrote about what happened). Both are valuable. Observation is higher-signal for questions about current market state.

## Sub-Agent Instructions

When spawning research sub-agents during exploration:
- Each agent gets ONE sub-question or observation task.
- Agents MUST do **web research** (WebSearch, WebFetch) — not just reason from training data. An agent that returns analysis without having fetched any URLs has failed.
- Agents should write up findings as structured notes (bullet points with sources), not polished prose.
- Target: each agent should produce ~800-1500 words of research notes.
- Agents should note what they DIDN'T find or couldn't verify — gaps are signal too.
- Agents should include raw URLs/sources so the user can follow up.

## Transition Signals
- **User signals convergence**: "okay let's go with X", "I think the answer is", "let's narrow this down", "what do you recommend".
- **User signals more divergence**: "what else", "are there other options", "I'm not sure yet", "let's also look at".
- **Natural convergence**: when the research stops turning up new information AND budget minimums are met.
- **User can always override**: "keep going" (ignore budget, do another round) or "wrap it up" (converge now even if budget isn't met).

## Rules
1. Don't write code during exploration unless it's a quick proof-of-concept to test feasibility.
2. Don't save exploration artifacts to memory unless the user explicitly says to remember something. Exploration is ephemeral by default.
3. Keep inter-round summaries short — the user is thinking, not reading essays. Save the detail for the final synthesis and scratch file.
4. If the exploration spans multiple topics, track them as a lightweight list in the chat (not tasks — tasks imply commitment to execute).
5. **Never shortcut the budget.** The whole point is to force depth. If you think you have a good answer after round 1, you're wrong — keep digging.
6. **An agent that doesn't fetch URLs has failed.** Every sub-agent must bring back external data, not training-data reasoning.
