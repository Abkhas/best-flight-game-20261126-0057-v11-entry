# EMBERLINE 11 — Fireline Landing

A Three.js wildfire tanker + evacuation game for the make.fun
best-flight-game-20261126-0057 bounty ("Make the best flight game").

## The sortie (sortie 3 of 3)

Scoop Bluebird Lake, drop Town Edge and Ridge Line, evacuate 6 from Pine
Hollow — then the second kind of flying: **the landing**. Low on fuel after
the evac, the tanker must land on the short, buoy-marked water strip at the
Fire Base, crosswind 295°/26 kt, with the right engine at 74% (thrust down
14%, pulling left, hold right rudder). Glidepath 3.0°, flare at 30 ft,
touchdown in the zone, roll-out — graded (EST GRADE A 94, ON RAILS x8).

- Wind shift mid-sortie: 240°/18 kt → 295°/26 kt.
- Damage-driven handling: the dead right engine yaws/rolls the aircraft;
  the pilot holds aileron trim, and the landing is flown in a crab.
- Live decision: LAND FIRE BASE (short, crosswind, graded) vs DIVERT
  BLUEBIRD LAKE (safe, Ridge Cabins burn). BINGO fuel.
- Graded precision: scoop skill check (60 ft / 80–140 kt), drop heights,
  glidepath, flare, touchdown zone, roll-out.
- Campaign: flight recorder, logbook, medals, pick-1-of-3 refit.

## How to run

- Play: `node serve.ts`, then open http://localhost:8080 (add
  `?shot=01-cover` / `02-cockpit` / `03-board` / `04-title` for a staged shot).
- Capture: `node ~/workspace/makefun-flight-game-20261126-0057-dev-scratch/capture-v11.mjs`
  (flies the record headless, saves screenshots/ + checks.json).
- Hand in: `node main.ts` writes the dossier to `$MAKEFUN_OUTPUT_DIR`
  (copy pattern — stdlib only, no re-render, no PIL).

## Files

- `game/index.html` — the page + HUD (gauges, tapes, checklist, decision,
  landing panel, radio, deadline).
- `game/src/world.js` — valley, lake, town, fires, strips, sky.
- `game/src/aircraft.js` — the twin-prop seaplane tanker.
- `game/src/flight.js` — flight model + waypoint autopilot.
- `game/src/mission.js` — the 16-phase sortie, events, scoring, record.
- `game/src/hud.js` — HUD updates from the flown record.
- `game/src/shots.js` — the four staged shots.
- `game/src/main.js` — entry: runs the sortie, stages the shot.
- `game/vendor/three.module.min.js` — Three.js r160 (vendored library).
