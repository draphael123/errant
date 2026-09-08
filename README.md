# ERRANT

A 3D fantasy platformer: a knight, a sword, and a sky of broken stones. Built on Three.js (vendored, no build step).

- Run locally: `node serve.mjs` then open http://localhost:5850
- Controls: WASD move · Space jump / double jump · LMB or J strike (3-hit chain) · E or K heavy · RMB or L guard (early guard = parry) · Shift roll · Esc pause
- Route: Meadow Landing → stepping stones → Ruined Courtyard (knaves) → Broken Bridge (movers, thornshot) → Watchtower spiral (crumbling stone) → the Warden's Ring (boss)
- Debug: `window.ERRANT.state()`, `ERRANT.go('courtyard'|'spiral'|'cap'|'arena')`, `ERRANT.god()`
