# Mini-Game Overhaul — Prompt Pack (EN prompts → KO output)

사용법: 위에서부터 순서대로 Claude Code에 하나씩 붙여넣기.
PHASE 0 → 0.5 → 1 → 1.5 → 2 → 3 → 4 순서를 지킬 것.
특히 **PHASE 0(감사)과 0.5(아트 디렉션)를 건너뛰면 개편이 아니라 리스킨이 된다.**
0.5는 게임 20개를 만들기 전에 끝내야 한다 — 나중에 하면 20개를 다시 칠해야 한다.

---

## ★ GLOBAL PREAMBLE — paste this at the start of EVERY new session

```
GLOBAL RULES for this project. These override any conflicting instruction later.

LANGUAGE
- Every player-facing string is Korean. UI labels, instructions, feedback,
  failure messages, debriefs, button text, tooltips: all Korean.
- Code identifiers, file names, comments, commit messages: English.
- Do not leave English in the UI except proper nouns (Claude Code, MCP, RAG),
  and when a proper noun appears, write it as 한국어 병기: 스킬(Skills).
- Never machine-translate. Write Korean copy natively: short, plain, no 번역투,
  no honorific overload. Target reader is a non-technical office worker.

DESIGN LAW (the core of this overhaul)
- MECHANIC-CONCEPT ISOMORPHISM: the reason the player fails in the game must be
  the SAME reason the concept fails in real life. If you can swap the concept
  for another one without changing the mechanic, the mechanic is wrong.
- BAN: multiple-choice quizzes, term-to-definition matching, "pick the correct
  word" games, drag-a-label-onto-a-picture. If a game can be won by reading the
  answer off the screen, delete it and design a real mechanic.
- The player must be able to LOSE for an interesting reason.
- Teach through consequence, not through text. Explanatory text appears only
  AFTER the player has already felt the outcome.
- IMPACT OVER COMPLETENESS: a moment the player will retell beats a screen that
  covers more material. If a beat is merely correct and forgettable, it is a bug.
- Points, badges, XP and stars are not fun. They are a record of fun. Never let
  them be the reason to keep playing.
- Nothing may look or behave like a web form. If a screen is a rectangle with
  labels and a submit-shaped button, redesign it.

TECH
- Vanilla HTML/CSS/JS, ES modules, no build step, no LLM API.
- Libraries ARE allowed, but only vendored: copy them into ./vendor/ with the
  version pinned in the path and load them with relative paths. No CDN, no
  package manager at runtime, zero network requests when the page runs. Verify
  each library's current license and record it in LICENSES.md before adopting.
- Mobile-first, 360px, touch must work (tap-to-tap fallback for any drag).
- All state in localStorage. No network requests at runtime.

PROCESS
- Before writing code for any game, state in one sentence WHY this mechanic is
  isomorphic to the concept. If you cannot, stop and propose a different one.
```

---

# PHASE 0 — Audit & Doctrine

### P0-1 · Audit what exists

```
Audit every existing mini-game in this project against this rubric. Score each
0-3 and give a one-line justification per row:

1. ISOMORPHISM — does losing in the game happen for the same reason the concept
   fails in reality?
2. IRREDUCIBILITY — could the player win by reading text off the screen without
   understanding anything? (3 = impossible)
3. AGENCY — does the player make a decision with a real trade-off, or just
   identify a correct item?
4. SURPRISE — is there a moment where the player's expectation is violated?
5. REPLAY — is a second playthrough different?
6. FEEL — is there tactile feedback, or is it a form with buttons?

Output a table, then a ranked list: REBUILD (score < 10), REWORK (10-14),
KEEP (15+). Be harsh. I would rather rebuild 15 games than ship 15 quizzes.
Do not write any code yet.
```

### P0-2 · Write the design doctrine

```
Write DESIGN_DOCTRINE.md (in Korean, since I will share it with colleagues).
It must contain:

1. The isomorphism law, with 3 worked examples from this project: one concept,
   the WRONG mechanic (a quiz), the RIGHT mechanic, and why.
2. A taxonomy of learning moments we are allowed to use:
   - PREDICT → REVEAL (player commits to a guess before seeing the truth)
   - BUILD → RUN → BREAK (player assembles, watches it execute, sees it fail)
   - PRESSURE → TRADE-OFF (limited resource forces a real choice)
   - REPAIR (player is given a broken system and must diagnose it)
   - INVERT (player plays the adversary or the victim, not the operator)
3. A banned-patterns list with reasons.
4. A rule for failure design: every failure state must be diegetic — the player
   sees the damage happen in the fiction, not a red X.

This document is the reference for every later prompt. Keep it under 2 pages.
```

### P0-3 · Kill list

```
Based on the audit, produce KILL_LIST.md: which mini-games get deleted outright,
which get rebuilt from scratch, which survive. For each deletion, name the
concept it was supposed to teach so we can reassign it to a new game.

Then propose the new roster: 16-20 mini-games, each tagged with its GENRE.
Hard constraint: no genre may appear more than twice across the whole roster.
Available genres include (extend the list if you have better ideas):
resource management, deckbuilder run, tower defense, routing/wiring puzzle,
real-time dispatch (Overcooked-like), detective/evidence board, live-diff
sandbox, telephone chain, triage under time pressure (Papers-Please-like),
hidden-object/anomaly hunt, idle/incremental, escape room, assembly line,
prediction market, reverse-engineering (guess the cause from the artifact),
step-debugger, negotiation/branching dialogue.

Show the mapping: concept → genre → one-sentence loop → why isomorphic.
Stop and wait for my approval before building anything.
```

### P0-4 · Re-architecture

```
The current 5-generic-engine architecture is what forced everything into
sort/pick shapes. Redesign the architecture so that mechanic variety is cheap:

- A shared SHELL (course map, HUD, debrief panel, codex, save/resume) that every
  game mounts into, with a strict lifecycle contract:
  mount(container, ctx) / update(dt) / teardown() / getResult().
- A shared TOOLKIT of reusable primitives that any genre can compose:
  drag-drop with touch fallback, grid, timeline scrubber, node-graph with edges,
  tick-based simulation loop, typewriter log renderer, particle/impact feedback,
  countdown, scoring, replay recorder.
- Each mini-game is then a SELF-CONTAINED MODULE free to implement its own rules,
  importing primitives instead of inheriting a rigid engine.

Write ARCHITECTURE.md with the lifecycle contract, the primitive list with
signatures, and a worked example of one game module using three primitives.
Then refactor the shell and toolkit. Do not port the old games yet.
```

---

# PHASE 0.5 — Full UI/UX Redesign

게임 메커닉만 고치면 여전히 밋밋하다. 껍데기도 같이 갈아엎는 단계.
**PHASE 1 이전에 실행할 것** — 아트 디렉션이 정해져야 게임 20개를 같은 언어로 만들 수 있다.

### P0.5-1 · Kill the current look — honest UI audit

```
Audit the current UI as if you were an art director reviewing a competitor's
product, not defending your own work. Answer in writing:

1. Screenshot-test: if I showed one screen with no text, would anyone remember
   it 10 seconds later? Why not?
2. Which parts look like a generic component library, a bootstrap admin panel,
   or an AI-generated default? Name them specifically.
3. Where does the interface look like a FORM rather than a GAME? List every
   place with a rectangle, a label, and a submit-shaped button.
4. Is the visual hierarchy carrying meaning, or is everything the same weight?
5. What is the ONE visual idea of this product right now? If you cannot answer
   in five words, that is the finding.

Be blunt. Do not propose fixes yet.
```

### P0.5-2 · Three art directions, not one

```
Propose THREE distinct art directions for a full visual overhaul. Do not
converge them into one safe middle option — they must be genuinely different
bets, and I will pick.

For each direction give: a five-word thesis, the world it borrows from, the
palette (with roles, not just hex), the type pairing (Korean-first), the shape
language, the motion personality, and one sentence on what it would make the
player FEEL. Then mock up the same single screen — a mini-game in progress — in
all three so I can compare like for like.

Constraints:
- Direction A must be an elevated version of the current bright theme: keep the
  approachability, kill the blandness. Show me what "bright but confident" is.
- Directions B and C must go somewhere the current design would never go.
- BANNED across all three: cream + serif + terracotta, black + neon green,
  purple-blue AI gradients, glassmorphism, generic rounded-card dashboards,
  emoji as iconography.
- This is for non-technical office workers on mobile. Distinctive, not alienating.
- All copy in the mockups must be Korean.

Explain the trade-offs and give your own recommendation with a reason.
```

### P0.5-3 · Design tokens and the system

```
Once I pick a direction, build the design system properly before touching any
game.

- Tokens as CSS custom properties: color roles (surface, ink, accent, success,
  partial, failure, danger, muted), spacing scale, radius scale, elevation,
  type scale, motion durations and easings. Semantic names only — no --blue-500.
- A type scale tuned for Korean: line-height and letter-spacing set for Hangul,
  not inherited from a Latin scale. Body must stay legible at 360px.
- One documented exception mechanism, so games can break the system
  intentionally instead of accidentally.

Write DESIGN_SYSTEM.md and a live tokens page that renders every token so I can
review it in the browser.
```

### P0.5-4 · Rebuild the shell, not just the skin

```
Redesign the shell itself, not its colors:

- COURSE MAP: right now it is probably a list of nodes. Make it a place — a
  space the player moves through with a sense of position, progress, and what
  lies ahead. Locked content should be visible and tempting, not hidden.
- HUD: minimal, diegetic where possible. Nothing that looks like a browser form.
- DEBRIEF: currently a text panel. Redesign it as the payoff moment of the game
  — it should feel like a reveal, with the player's own run replayed or
  reconstructed inside it.
- TRANSITIONS: entering and leaving a game must be a directed moment, not a
  route swap. The player should feel they walked in somewhere.

All labels in Korean. Rebuild, do not reskin.
```

### P0.5-5 · Iconography and illustration, built not borrowed

```
We cannot use icon libraries or CDNs. Build a small, consistent inline-SVG icon
and illustration set that belongs to the chosen art direction: one stroke width
rule, one corner rule, one perspective rule.

Include the recurring cast of visual objects this product needs: 문서, 도구,
에이전트, 컨텍스트 조각, 권한, 검증 게이트, 사고. These objects appear in many
games, so they must be instantly recognizable across all of them. Draw them once,
reuse everywhere.
```

### P0.5-6 · Motion language

```
Define the motion language as a spec, then implement it as reusable primitives:
- what enters, and how (never fade-only — fades read as cheap)
- what has weight, what is instant
- the signature easing that everything shares
- what motion is reserved exclusively for meaning: 성공 / 부분성공 / 실패 /
  위험 / 발동(a tool firing) — these five must never share an animation
- reduced-motion equivalents that keep the information

Write MOTION.md, implement, and demo all of it on one page.
```

### P0.5-7 · Build the motion stack — use real libraries, vendored locally

```
Stop hand-rolling animation. Bring in a proper motion stack and use it
aggressively. The no-CDN rule stays, but it does NOT mean no libraries — it means
every library is VENDORED into the repo and served with relative paths, so the
site still makes zero network requests at runtime.

Step 1 — survey. Evaluate candidates against our constraints (vanilla JS, no
build step, ES-module or UMD usable directly, permissive license, reasonable
size). Cover at least:
- timeline choreography: GSAP (with its plugins), Motion One, anime.js
- vector animation playback: Lottie (lottie-web / lottie-light)
- interactive state-machine animation: Rive runtime
- particles and impact FX: tsParticles, Pixi.js, or a small custom emitter
- physics and weight: matter.js
- SVG path work: line-drawing and morphing options
- text motion: Splitting.js / SplitType-style grapheme splitting — VERIFY it
  segments Hangul correctly before adopting; most of these are Latin-first
- native platform features we should prefer over any library where they are
  strictly better: View Transitions API, scroll-driven animations, Web Animations
  API, @property, CSS @scope

Step 2 — verify licenses individually and record them. Some animation libraries
have changed license terms recently, and this will be published on a public
GitHub repo by a company. Do not adopt anything whose current terms you have not
read. Write LICENSES.md with the library, version, license, and source URL.

Step 3 — vendor them under ./vendor/ with the version pinned in the path, and
document in README how to update them. No package manager at runtime.

Step 4 — set the budget before you install anything: shell + first screen under
300KB gzip, each lazily-loaded game module under 200KB, first meaningful paint
under 1.5s on a throttled mid-range phone. Lazy-load per node. If a library
cannot pay for its weight in felt quality, cut it and say so.

Deliver MOTION_STACK.md: what you chose, what each one is responsible for, what
you rejected and why.
```

### P0.5-8 · Now actually use it — maximal motion pass

```
With the stack vendored, do an ambitious motion pass across the whole product.
The current build is under-animated and reads as static; err on the side of too
much, then cut in review. Assign every one of these to a specific tool in the
stack and implement:

- CHOREOGRAPHED TRANSITIONS between shell and each game — directed sequences with
  staggered elements, not fades. Use View Transitions where it wins.
- COURSE MAP as a living place: parallax depth, idle motion, nodes that react to
  the player's history, locked nodes that visibly want to be opened.
- THE FIVE MEANING-ANIMATIONS (성공 / 부분성공 / 실패 / 위험 / 발동) authored as
  real motion pieces, distinct in timing and shape, reused identically everywhere.
- IMPACT MOMENTS (see P1.5-2): each one gets a bespoke animated sequence, using
  Lottie or Rive where a hand-drawn moment beats procedural motion. These are the
  20 seconds of the product that matter most — spend the budget here.
- IN-GAME PHYSICALITY: objects with weight, settling, elastic grabs, collision
  response, particles on placement and failure.
- DEBRIEF as a reveal: the player's own run reconstructed and replayed with
  annotation, not a text panel sliding in.
- MICRO-MOTION everywhere: hover, press, focus, drag pickup, drop, invalid-drop
  refusal, number counting, bar overshoot, list restaggering.
- LOADING AND EMPTY STATES: no spinners. Author them.

Rules that do not bend:
- Motion must carry meaning. If an animation could be swapped between a success
  and a failure without confusing anyone, it is decoration — cut it.
- Never block input on an animation. Everything is skippable and interruptible.
- Nothing may fire on a loop in the periphery while the player is deciding.
- Full reduced-motion path that preserves the causal information through timing
  and state changes rather than removing the lesson.
- All Lottie/Rive assets are authored or sourced with clear licensing and stored
  in the repo. Any text inside them must be Korean.
```

### P0.5-9 · Use Claude Code plugins and skills for this work

```
Use the tooling available to you rather than doing everything from memory.

- Check the plugin marketplace for plugins and skills that help with frontend
  design, motion, design review, accessibility auditing, and visual regression.
  Install the ones that genuinely apply to this project and tell me what you
  installed and why. Do not install things speculatively.
- Set up a VISUAL ITERATION LOOP, which matters more than any single plugin:
  drive a headless browser to screenshot each screen and each animation at key
  frames, look at the screenshots yourself, critique them against
  DESIGN_SYSTEM.md and MOTION.md, and iterate. Never call a screen finished
  without having looked at a render of it.
- Capture short frame sequences of the five meaning-animations and the 20 impact
  moments, review them as filmstrips, and fix the timing that reads wrong.
- Add a small script so I can regenerate all screenshots in one command for
  review before deployment.

Report which plugins/skills you installed, what the visual loop caught that you
would otherwise have missed, and what you fixed as a result.
```

### P1-1 · Feedback and game feel

```
Build a shared "juice" module. Most educational web games fail because they feel
like forms. Implement, as reusable primitives:
- impact feedback on every meaningful action (scale punch, shake, flash)
- state transitions that animate rather than swap
- a sound-free feedback language (this will be played in an office — assume
  muted audio, so all feedback must be visual and legible without sound)
- a "consequence camera": when something goes wrong, the view moves to where the
  damage is happening instead of popping a dialog
Respect prefers-reduced-motion with a genuinely usable fallback, not a blank one.
```

### P1-2 · Failure theater

```
Build the failure system. Every failure type gets a staged, diegetic sequence:
hallucination, workslop, context overflow, security incident, infinite loop,
merge conflict between agents, verification debt.

For each: a 2-4 second animated consequence, then a debrief panel in Korean with
exactly three parts — 무슨 일이 일어났나 / 왜 일어났나 / 실제 업무에서는 이렇게 보인다.
No red X, no "틀렸습니다". The player should think "아 그래서 그렇구나", not
"내가 답을 못 맞췄구나". Write the Korean copy for all seven failure types now.
```

### P1-3 · Korean copy system

```
Centralize every player-facing string into src/i18n/ko.js as a single flat
dictionary with dotted keys. No hardcoded Korean in component files. Then write
a lint script that fails if any Hangul literal appears outside ko.js.

Copy rules to apply while extracting: max 2 lines per instruction, no 번역투,
no 존댓말 남발, imperative and short. Rewrite anything that reads like it was
translated from English.
```

### P1-4 · Input layer

```
Build one input abstraction that all games use: pointer, touch, and keyboard
produce the same events. Requirements:
- every drag interaction has an automatic tap-to-select → tap-to-place fallback
- long-press for inspect on touch, hover for inspect on desktop
- full keyboard path for every game (tab to focus, space/enter to act, arrows to
  move) — this is a corporate audience, some will play on a locked-down desktop
Then verify each game twice: once mouse-only, once touch-only, once keyboard-only.
```

### P1-5 · Difficulty and pacing

```
Design the pacing curve for the whole course. Rules:
- Every mini-game teaches exactly ONE idea. If it teaches two, split it.
- First 30 seconds of any game must be playable without reading instructions.
- Each game: a gimme round, a real round, then a round that breaks the pattern
  the player just learned (this is where the concept actually lands).
- Total run under 20 minutes; no single game over 2 minutes.
Write PACING.md mapping the emotional beat of each game (confidence → doubt →
insight) and check that we never run three high-pressure games in a row.
```

### P1-6 · Progress, save, and the shame-free loop

```
Implement save/resume, chapter unlocking, and a no-punishment retry loop:
failing a game never blocks progress, but the debrief offers "다시 해보기" and
the codex entry is only marked 완전 이해 after a clean run. Track per-game
attempt counts locally so the results card can say something honest at the end
without ever displaying a failing grade.
```

---

# PHASE 1.5 — Fun & Impact

"교육용인데 재미없다"의 반대말은 포인트와 배지가 아니다. 이 페이즈는 그 차이를 강제한다.

### P1.5-1 · The fun doctrine

```
Write FUN_DOCTRINE.md (Korean) before implementing anything.

State plainly what we are NOT doing: points, badges, stars, XP bars, streak
counters and leaderboards are the lazy version of fun. They decorate a boring
loop instead of fixing it. We may use them only as a record of what happened,
never as the reason to keep playing.

Then define where our fun actually comes from, with a concrete example from one
of our games for each:
1. AGENCY — the player's decision visibly caused the outcome
2. SURPRISE — the game violates an expectation it deliberately built
3. ESCALATION — the same mechanic gets harder in a way that reframes it
4. MASTERY — round 3 feels different because the PLAYER got better, not because
   difficulty numbers changed
5. EXPRESSION — two players can solve it differently and both feel clever
6. STAKES — something is visibly lost when they fail

Any game that scores zero on all six gets sent back to redesign.
```

### P1.5-2 · One impact moment per game

```
Every mini-game must have exactly ONE designed impact moment — the single second
a player would screenshot, or describe to a colleague at lunch.

For each of the 20 games, specify that moment, then build it with more care than
the rest of the game combined: the context overflow where a fragment they needed
silently rots; the injection they wrote themselves succeeding; the approval pile
doubling in front of them; the parallel agents colliding.

Rules: the impact moment must be a CONSEQUENCE, never a congratulation. It must
happen in the play area, not in a modal. It must be legible without sound.
Write IMPACT_MOMENTS.md listing all 20, then implement them.
```

### P1.5-3 · Juice pass

```
Do a full game-feel pass. Nothing in this product should respond instantly and
blandly. Implement as shared primitives and apply everywhere:

- anticipation before an action resolves, follow-through after it
- weight: heavy objects settle, light ones snap
- impact frames on collision, placement, firing, failure (hold 2-3 frames)
- screen-space feedback proportional to stakes — a small tick for a placement, a
  real jolt for an incident. Never shake for something trivial
- juicy state changes: numbers count, bars overshoot then settle, things land
- cursor/touch affordance: objects react on hover and on grab, before release

Assume muted audio. Everything must read visually. Respect reduced-motion with a
version that still communicates weight through timing and scale.
```

### P1.5-4 · Escalation and stakes

```
Rework difficulty as escalation, not as bigger numbers. For each game define a
three-beat structure:
- BEAT 1 teaches the rule by letting the player succeed
- BEAT 2 makes the rule cost something
- BEAT 3 breaks the rule's comfortable version and forces a real decision

Then add persistent stakes across the run: consequences from earlier chapters
should follow the player. Debt taken on in the workslop desk shows up as extra
load later. A permission left wide open in the MCP game gets exploited in a
later scenario. The player should feel the course is one continuous world,
not 20 unrelated tabs.
```

### P1.5-5 · Voice and personality

```
The product currently has no voice. Give it one, in Korean.

Write a short voice guide: dry, competent, occasionally funny, never cute, never
corporate-cheerful, never scolding. It talks to the player like a sharp colleague,
not like an e-learning module. Then rewrite every string in ko.js in that voice —
especially failure messages, which should be wry rather than apologetic.

Optionally introduce a light recurring presence (a colleague character who
reacts to the player's output). If you do, keep it to one or two lines per game
and make it react to what actually happened in the run, not generic praise.
```

### P1.5-6 · Discovery and collection

```
Make the codex and the tool catalog feel like collections worth completing, not
reference tabs.

- terms unlock with a physical animation at the moment they are experienced
- rare finds: a few hidden outcomes only reachable by unusual play (letting the
  loop run infinitely, defending against an injection with the elegant option,
  solving a ticket with an unexpected but valid tool combination)
- the collection view should show HOW each was earned, from the player's own run
- completion is visible but never required

Do not add a percentage bar and call it done. Make finding things feel like
finding things.
```

### P1.5-7 · The "one more" hook

```
Design deliberate pull between games. At the end of each game the player should
see, in one glance, something that makes them want the next node: a tease of the
tool that would have solved what just went wrong, a locked node that visibly
reacts to what they just did, an unresolved consequence.

Never do this with a "다음" button and a progress percentage. The pull must come
from unfinished business in the fiction.
```

### P1.5-8 · Shareable ending

```
Rebuild the ending. The result card must be worth sending to a colleague:
it should describe the player's actual decisions and failures in one wry Korean
paragraph, name the two moments where they did something interesting, and show
their run seed so someone else can attempt the same run.

No score out of 100, no ranking against other players, no grade. Make it feel
like a story of their run, generated deterministically from what they did.
```

---

# PHASE 2 — The Mini-Games

각 프롬프트는 하나씩 실행. 앞의 GLOBAL PREAMBLE을 세션마다 같이 붙일 것.

### P2-01 · Context window — resource management

```
Build the context window game as a resource-management puzzle, not a bag-packing
toy.

Loop: information fragments arrive over time, each occupying a different number
of slots. Capacity is fixed. When it overflows, the OLDEST fragment silently
degrades — it does not disappear with a warning, it fades and its text becomes
partially wrong. Then a task arrives that requires a specific fragment.
The player may spend an action to 압축(compact) three fragments into one summary
fragment: saves space, but permanently loses one detail chosen by the game.

The intended insight: 압축은 공짜가 아니고, 사라진 정보는 조용히 사라진다.
Round 3 must require a detail that the player already compacted away.
```

### P2-02 · Hallucination — detective evidence board

```
Build a grounding game, not a spot-the-lie quiz.

The player gets an AI answer of 6-8 sentences and a set of source documents.
They must physically connect each sentence to the span of source text that
supports it, drawing a line on an evidence board. Sentences with no valid anchor
must be marked 무근거.

Design constraint that makes it teach: the ungrounded sentences must be the most
fluent, confident and plausible ones in the answer, and at least one grounded
sentence must sound doubtful. The insight is 유창함과 근거는 무관하다.
Do not color-code the answer. Do not reveal which are fake until the player
commits all anchors.
```

### P2-03 · Prompt engineering — live diff sandbox

```
Build a target-matching sandbox. The player is shown a TARGET output and a weak
prompt. They modify the prompt using composable blocks (역할, 맥락, 형식, 예시,
제약) and the output re-renders live from a deterministic rule engine.

Requirements:
- the output must change in a legible, causal way when a block is added/removed,
  and a diff highlight must show exactly what changed
- some blocks conflict; adding both degrades output (teaches that more is not
  better)
- score on distance-to-target, not on number of blocks used
The insight: 어떤 요소가 출력의 어떤 부분을 움직이는지의 인과 지도.
```

### P2-04 · RAG — escape room in a document archive

```
Build retrieval as an escape room. The player must answer a question but the
answer exists only across two documents in an archive of ~20. They search by
typing keywords; the search is a deterministic keyword matcher you implement, so
bad queries genuinely return bad chunks.

Retrieved chunks are then handed to the AI, which composes an answer strictly
from what it was given. If the player passes an irrelevant chunk, the answer
becomes confidently wrong — and the player sees that their own retrieval choice
caused it.
The insight: 검색 품질이 답 품질의 상한선이다.
```

### P2-05 · Model vs product — assembly line

```
Build a factory floor. Engines (models) come down one belt; chassis (products
and surfaces) come down another. The player installs engines into chassis and
ships them.

Structural requirement: the SAME engine must be installable into several
different chassis, and one chassis must accept several engines. Shipping a unit
shows what the finished thing actually does. When the player later swaps an
engine under a chassis, the product keeps its identity but changes behaviour.
The insight: 모델은 엔진, 제품은 차체 — 1:N 관계라는 걸 손으로 겪게 하는 것.
No labels-into-bins. This is an assembly interaction.
```

### P2-06 · Choosing the surface — air traffic control

```
Build a dispatch/control-tower game. Incoming work items must be routed to a
surface: 채팅 / 프로젝트 / 아티팩트 / Claude Code / Cowork / 오피스 연동.

Each route has a real cost model you simulate: setup time, context re-explaining
cost, and output reusability. Wrong routing does not show an error — the item
comes BACK after a delay with wasted time on the clock, and the player must
re-route it. Pressure rises as more items queue.
The insight: 표면 선택은 정답 찾기가 아니라 비용 선택이다.
```

### P2-07 · The name trap (Claude Code / Codex) — predict then reveal

```
Build a prediction game. The player is shown real non-coding office tasks
(파일 200개 이름 일괄 변경, 폴더 정리, 문서 형식 변환, 엑셀 취합) and must bet
YES/NO on "이걸 Claude Code로 할 수 있을까?" before seeing the answer.

Their bet is locked in visibly, then the actual run plays out. Track their
prediction accuracy and show the bias explicitly at the end: 대부분의 사람이
'개발자 도구'라는 이름 때문에 NO를 고른다.
Include the Codex misconception the same way (2021년 모델 ≠ 현재 제품).
The insight must come from the player's own wrong bet, not from a text panel.
```

### P2-08 · Skills / subagents / hooks / commands / plugins — trigger timeline

```
Do NOT build a sorting game for these five. Build a TRIGGER TIMELINE.

A task executes along a timeline. The player pre-places tools on the timeline
and then watches execution. Each tool type fires by a different rule:
- 커맨드: fires only when the human presses it
- 스킬: fires automatically when the situation matches, and only then
- 서브에이전트: forks into its own lane with its own isolated context, returns
  a summary
- 훅: fires deterministically at a fixed point, every single time
- 플러그인: places a bundle of the above at once
The player's goal is to make the run finish correctly; they lose when a tool
never fires, fires too late, or fires every time when it shouldn't.
The insight: 다섯 개의 차이는 '언제 발동하느냐'이다. Make firing visible.
```

### P2-09 · MCP and least privilege — wiring plus adversary round

```
Build a two-phase wiring game. Phase 1: connect the agent to external systems
(메일, 캘린더, 사내 문서, 결제) by routing cables, and set a permission level on
each cable (읽기 / 쓰기 / 전체).

Phase 2 is the twist: an adversarial scenario runs against the wiring the player
just built. Over-permissioned cables cause a visible incident; under-permissioned
ones cause the task to fail. The player must go back and find the minimum viable
permission set.
The insight: 최소 권한은 보안 구호가 아니라 설계 작업이다.
```

### P2-10 · CLAUDE.md / AGENTS.md — rule budget with contradictions

```
Build an onboarding-document builder with a hard rule budget. The player picks
rule cards for a new AI worker; the budget is smaller than the number of good
rules, so they must choose.

Critical mechanics:
- two rule cards in the deck directly contradict each other; including both makes
  behaviour erratic and the player must diagnose why
- one rule is so vague it produces unpredictable results (teaches specificity)
- adding many low-value rules dilutes the high-value ones — model this explicitly
Then the AI performs a task and the player watches which rules actually fired.
The insight: 지침은 유한 자원이고, 모순은 침묵 속에서 망가뜨린다.
```

### P2-11 · Subagents and orchestration — real-time dispatch

```
Build an Overcooked-style dispatch game. Multiple jobs, multiple agents, a clock.
The player assigns work serially or in parallel.

Structural requirements:
- each agent sees ONLY what the player hands it (context isolation is literal:
  the agent's panel shows only its own inputs)
- parallel is faster but two agents given overlapping work produce conflicting
  outputs that must be merged, costing time
- a coordinator agent can be spawned that costs capacity but prevents conflicts
The insight: 병렬화의 이득과 컨텍스트 격리의 대가를 동시에 체감시키는 것.
```

### P2-12 · Context rot — telephone chain

```
Build a broken-telephone chain. A precise instruction passes through 5 agents;
at each hop, some information is dropped by a deterministic decay rule and the
player watches the message mutate in place.

The player intervenes by installing at most two devices along the chain:
요약 규칙, 원문 첨부, 중간 검증. Each has a cost. The goal is for the final
output to still satisfy the ORIGINAL requirement, which is shown only at the
start and hidden during the run.
The insight: 체인이 길수록 원본은 조용히 사라진다.
```

### P2-13 · The agent loop — step debugger

```
Build a step-through debugger for the agent loop (관찰 → 계획 → 행동 → 관찰).
The player advances the loop one step at a time and must set the termination
condition themselves before starting.

Failure modes to implement: no termination condition → visible infinite loop
that the player must halt; too strict → stops before finishing; a loop where the
agent keeps retrying the same failing action because nothing changed between
iterations.
The insight: 에이전트는 멈추는 조건을 사람이 정해줘야 멈춘다.
```

### P2-14 · Hooks and harness — tower defense

```
Build a tower-defense lane. An autonomous agent runs down the lane executing
actions; dangerous actions are the "enemies". The player places validation gates
(훅, 테스트, 승인 요청, 샌드박스) along the lane.

Trade-off to model precisely: every gate adds latency and cost. A fully gated
lane is safe but so slow that the level fails on the throughput requirement. An
ungated lane is fast until one dangerous action reaches the end and destroys the
run. There must be no configuration that is both maximally safe and maximally fast.
The insight: 하네스 설계는 안전과 속도 사이의 배치 문제다.
```

### P2-15 · Workslop — triage under pressure with compounding debt

```
Build a Papers-Please-style approval desk. AI-generated deliverables arrive; the
player checks each against a 3-point rubric (근거 있음 / 요구사항 충족 / 실행
가능) and approves or rejects under a clock.

The mechanic that makes it teach: approved-but-bad items come BACK in the next
round as rework, doubled. Rejecting good work also costs. By round 3 a player who
rubber-stamped is buried in their own backlog and can see the pile.
The insight: 검증을 건너뛴 비용은 사라지지 않고 복리로 돌아온다.
```

### P2-16 · Prompt injection — play the attacker first

```
Build this in two halves and put the ATTACKER half first.

Half 1: the player writes a hidden instruction into a web page / document that
the agent will read, choosing where to hide it and what to ask for. They watch
their injection succeed against a naive agent.
Half 2: they switch sides and must defend the same agent, choosing among
countermeasures (출처 구분, 권한 축소, 사람 승인, 도구 차단) against three
injection attempts including their own.
The insight: 데이터와 명령의 경계가 무너지는 게 공격의 본질이다. Playing the
attacker for 40 seconds teaches this better than any warning screen.
```

### P2-17 · Automation ROI — idle/incremental

```
Build a small idle game. The player automates a repetitive task; throughput
climbs and the numbers feel great.

Then model the thing idle games never model: error rate is constant, so volume
multiplies errors. Undetected errors accumulate into an incident that wipes a
chunk of the gains. The player must spend throughput on review capacity, and
find the equilibrium themselves. Show a live 처리량 / 사고 위험 dual gauge.
The insight: 자동화는 실수도 같이 자동화한다.
```

### P2-18 · Shadow AI and the data boundary — sorting is banned, use a boundary map

```
Build a data-boundary map instead of a quiz. The office is drawn as concentric
zones: 내 PC / 사내망 / 승인된 클라우드 / 미승인 외부 서비스. Documents have
sensitivity levels.

The player drags work into whichever zone will get it done fastest — and the
fastest option is usually the unapproved one, which is exactly the real
temptation. Consequences are delayed by one round so the player experiences why
this is hard: nothing bad happens immediately.
Also include the local-LLM option as a slower but boundary-safe path.
The insight: 섀도우 AI는 나쁜 사람이 아니라 급한 사람이 만든다.
```

### P2-19 · Tool landscape — reverse-engineer the artifact

```
Do not build a tool-name matching game. Build a reverse-engineering game.

The player is shown finished artifacts (a cinematic 5s clip, a talking-head
explainer, a 20-source research memo, a working web app, a slide deck, a cleaned
spreadsheet) and must deduce WHICH CATEGORY of tool produced each, citing the
tell-tale trait. Then they are given a new brief and must pick the category.

Categories, never individual product names, are the answer space — products
change, categories don't. On reveal, show the current examples in that category
from data/tools.js with their checkedAt date.
The insight: 도구는 결과물의 형태로 구분된다.
```

### P2-20 · Final run — roguelike

```
Rebuild the final stage as a short roguelike run for replayability.

The player drafts a hand of tool cards from a random offering, then faces three
randomly drawn business tickets. Cards carry costs; the same ticket can be solved
several valid ways with different trade-offs. Failures are graded by type
(환각 / 워크슬롭 / 컨텍스트 초과 / 보안사고) and feed the end-of-run summary.

Runs must differ meaningfully. Include a seed so a colleague can share a run.
End with a shareable 결과 카드 summarizing decisions, not a score out of 100.
```

---

# PHASE 3 — Polish

### P3-1 · Wordless onboarding

```
Remove every tutorial text block. Replace with in-situ teaching: the first
interactive element of each game is pre-highlighted, the first action is
constrained so it cannot be done wrong, and the rule is discovered by doing.
Test: can a first-time player start correctly with all instruction text hidden?
Fix every game where the answer is no.
```

### P3-2 · Anti-quiz audit

```
Re-audit the entire build against the banned-patterns list. For any game where a
player could succeed by pattern-matching text on screen without understanding the
concept, rewrite the mechanic. Report the list of violations you found and fixed.
Be specific about which interaction leaked the answer.
```

### P3-3 · Comprehension probe, not a test

```
At the end of each chapter, add a 15-second APPLICATION beat: a novel situation
the player has never seen, solvable only with the idea just learned, playable in
one or two actions. No text answers, no multiple choice. If they miss it, the
debrief replays the moment from their own earlier run where the idea appeared.
```

### P3-4 · Codex integration

```
Wire every game to the term codex so that terms unlock at the moment of
experience, not at the end. When a concept is first FELT (the overflow happens,
the injection lands), the term card animates into the codex with the player's own
run as the example: "당신의 3라운드에서 이 일이 일어났습니다".
```

### P3-5 · Accessibility pass

```
Full pass: keyboard-only completion of every game, visible focus, screen-reader
labels on interactive nodes, contrast check, reduced-motion equivalents that
preserve the causal information (do not just disable the animation that carries
the lesson — replace it with a stepped state change).
```

### P3-6 · Visual consistency sweep

```
Play through everything and find where the 20 games drifted apart visually.
Same object must look the same in every game; the five meaning-animations must
behave identically everywhere; spacing and type must come from tokens with no
one-off values. Fix by pulling games back into the system — except where a game
breaks it deliberately, which must be documented as an exception.
```

### P3-7 · Performance and size

```
Profile on a mid-range phone against the budget set in P0.5-7: shell + first
screen under 300KB gzip, each lazily-loaded game module under 200KB, first
meaningful paint under 1.5s throttled, no frame drops in the real-time games or
during impact moments. Lazy-load game modules and their motion assets per node.
No layout thrash in tick loops; animate transform and opacity, and keep anything
heavier off the main thread.

Then audit the motion stack honestly: for every vendored library, name what it is
actually doing in the shipped build. Anything used for one trivial effect gets
cut and hand-rolled. Report before/after payload.
```

---

# PHASE 4 — Validation

### P4-0 · The lunch test

```
For each mini-game answer one question honestly: would a player describe this to
a colleague at lunch? If yes, quote the sentence they would say. If no, the game
has no impact moment yet — send it back to P1.5-2.
Report the list of games that fail this test before fixing anything else.
```

### P4-1 · Simulated playtest

```
Play the entire course three times as three personas and write an honest report:
(a) 45세 비개발자 사무직, 모바일, 교육을 억지로 듣는 중
(b) 28세 마케터, AI를 매일 쓰지만 개념은 모름
(c) 개발자, 다 안다고 생각함
For each: where did they get confused, where did they want to quit, where did
they feel something click. Timestamp everything. Then fix the top 5 issues.
```

### P4-2 · The one-sentence test

```
For each of the 20 concepts, write the sentence a player should be able to say
after playing. Then trace exactly which moment in which game produces that
sentence. Any concept without a traceable moment is not taught — redesign that
game. Output the traceability table.
```

### P4-3 · Failure-path coverage

```
Play every game deliberately badly. Every failure branch must produce a staged
consequence and a Korean debrief; none may dead-end, spam the console, or leave
the player unable to continue. Report coverage as a checklist.
```

### P4-4 · Copy pass

```
Read every Korean string aloud as if presenting to colleagues. Rewrite anything
that sounds translated, condescending, or like documentation. Cut every sentence
that explains something the player already experienced. Target: no screen with
more than two lines of instruction.
```

### P4-5 · Ship check

```
Verify: zero network requests, works from file://, works on GitHub Pages with
relative paths, 360px clean, touch-only clean, keyboard-only clean, localStorage
reset clean, full run under 20 minutes, every game module independently
removable. Then update README.md and GAME_SPEC.md to match what actually shipped.
```

---

## 우선순위가 급할 때 (최소 코스)

P0-1 → P0-3 → P0.5-2 → P0.5-3 → P0.5-7 → P0.5-8 → P1-2 → P1.5-2 →
P2 중 가장 심한 5개 → P3-2 → P4-0

아트 디렉션(P0.5-2)과 임팩트 모먼트(P1.5-2)는 최소 코스에서도 빼지 말 것.
이 둘이 "밋밋함"을 직접 겨냥하는 프롬프트다.
