# velvet-hour

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/qmyCode/velvet-hour/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/qmyCode/velvet-hour/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Velvet Hour** — 6 vaults, 15 guards, one star: a top-down stealth game where lantern light is the only law. You are a moth-quiet thief in a lantern-lit vault house at night. Steal the Aurelian Star from each vault and reach the exit hatch unseen, past guards whose vision cones stop dead at crates and shelves, whose patrols run on timetables you can learn (drawn on the floor as dashed routes with pause badges), and whose suspicion fills while you stand in lamplight and drains while you hide — so a near miss can still be escaped.

Every system is labelled on the scene itself: press **H** for Field Notes, a legend panel plus callouts that name the cone, the blind spot, the lamplight and the hatch, live on the photograph of the vault. Guards think out loud — **?** when suspicious, **!** when the alarm is up, and a spoken *"What was that?"* when a thrown coin sends them to look the other way.

## How to play

- **WASD / arrow keys** — move (walking is fast, and heard)
- **SHIFT / C** — sneak: slow, silent, hard to see; crouch in **tall grass** to vanish
- **Click** — throw a coin to that point; guards in earshot go to look
- **H** — Field Notes overlay · **R** — restart the vault · **P** — pause
- Lamplight betrays you, shadow hides you, and **creaky boards** are loud even sneaking. Lift the 3 loose valuables in each vault on your way. Caught only if a guard who is sure touches you; break line of sight and the alarm cools.

## Structure

Plain static files under `game/`, no libraries, no build step, no network — all art is canvas, all sound is synthesised WebAudio (footsteps that pan toward the nearest guard, a coin's clink, the alarm's sting). One job per file in `game/src/`:

- `main.js` — boot, the fixed-step loop, the screens, the thief's actions, the screenshot scenes
- `levels.js` — the six vaults as data: walls, cover, lanterns, patrols, grass, boards, loot
- `guards.js` — patrol / suspicious / investigate / hunt minds and the recovering suspicion meter
- `vision.js` — cone geometry with cover occlusion, lantern light and shadow
- `render.js` — the framed HUD, Field Notes and callouts, floor, light, cones, actors
- `audio.js` — WebAudio hush, footsteps, coin, alarm · `input.js` — keyboard and mouse

## Run it

```sh
node serve.ts   # then open http://localhost:8080 — or hand it in with: MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wd21nvpk&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
