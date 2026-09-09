# ERRANT — next pass: silence the noise, jump + dash, real combat audio, a grounded forest

Repo: `errant/` (run `node serve.mjs`, open http://localhost:5850). Live: https://errant-tau.vercel.app. Deploy with
`vercel deploy --prod --yes` from the folder after `git push`. Debug API is `window.ERRANT` (`state()`, `go('camp'|'spiral'|'cap'|'arena')`,
`teleport`, `god()`, `render()` returns a JPEG data URL, `perf`, `sfxLog`). F3 toggles the frame counter with the last SFX names.
The browser pane cannot screenshot WebGL: post `ERRANT.render()` to a scratchpad upload server and Read the JPEG.

Do the five jobs below in order. Verify each in the browser before moving on. Commit per job. Deploy at the end.

---

## 1. Find and kill the noise (highest priority)

Daniel hears an "awful noise" **while standing still AND while moving**. It is not tied to jumping. Facts already established, do not re-check them:

- It is not collision. An offline simulation of `physics.js` at 60 / 144 / 240 fps shows zero ground flicker (`onGround` never toggles at rest).
- Counting `AudioContext.createOscillator` / `createBufferSource` in his real Chrome while idle and while running showed **zero** synthesised sound nodes created. So it is not a spamming SFX and not the synth pad.
- The footstep sound was already replaced (soft thud, rate-limited) and the noise survived that, so it is not footsteps.
- Frame time was 40 ms+ before batching (1,255 draw calls); that is fixed (2 ms), and the noise survived that too.

What is left: **the file music path.** `startMusic('explore')` plays `audio/forest_theme.mp3` through `createMediaElementSource → gain → musBus`. Suspects, in order:
1. The `<audio>` element is ALSO audible directly. `createMediaElementSource` reroutes it, but if the source node is created on a context that is `suspended`, or created twice for the same element, Chrome can play the element raw and through the graph at once, or with a phase-offset copy that sounds like a flanged buzz.
2. `stopFile()` fades the gain but only pauses the element after 1.4 s; `startMusic` is called twice quickly on Set Forth (title → explore) and again on respawn (`returnToShrine` → `startMusic('explore')` when leaving the boss). Two elements alive at once = doubled, phasing music.
3. The `DynamicsCompressor` on master with threshold -14 / ratio 4 pumping against the music.
4. The mp3 itself. Play `audio/forest_theme.mp3` alone in a browser tab to rule it out.

Method (do all of it, do not guess):
- Add a settings-panel row **Music source: Files / Synth / Off** and use it to bisect: if the noise stops with Music off, it is the music path. If it stops on Synth, it is the file path.
- Guard `startFile` so an element can never be created while `file.el` exists; pause + `src=''` synchronously in `stopFile` (keep the gain fade only for the graph copy); never call `createMediaElementSource` while `ctx.state !== 'running'` (await `ctx.resume()` first).
- Remove the compressor, or set ratio 2 / threshold -6 / knee 20 and listen.
- Add an "audio probe" line to the F3 overlay: `ctx.state`, number of live `<audio>` elements, `musBus` gain, and an `AnalyserNode` RMS on master so the noise floor is a number Daniel can read to me.
- Ship the fix, then ask Daniel to confirm with Music off / on.

## 2. Jump + dash instead of double jump

Replace the double jump with a **dash**:
- Space = jump (keep hold-for-height, coyote time, jump buffer, apex hang, landing squash). Pressing Space again in the air does nothing.
- Shift = **dash** on the ground and in the air (one air dash until you land): 0.22 s burst at ~18 m/s in the input direction (facing if no input), no gravity during the dash, 0.12 s i-frames, a 0.9 s cooldown shown as a small pip under the stamina bar, stamina cost 15. Dash cancels the end of a strike like the roll used to. Keep the roll on **Ctrl / gamepad B** for players who want it, but the tutorial teaches dash.
- Re-space the level for jump + dash: single jump ≈ 6 m flat / 2 m rise; jump + dash ≈ 10 m. Stepping-stone gaps and the hollow-tree climb must be checked with a scripted bot (`ERRANT.teleport` + synthetic keydown) that proves every gap is crossable with jump+dash and NOT crossable with jump alone where a dash is intended.
- Update the tutorial step (`tutorial.js` "double" → "dash"), the controls table, the title foot line, the level signs ("IN THE AIR, PRESS SPACE AGAIN" → "SHIFT TO DASH ACROSS"), and the hints in `main.js`.
- Dash feel: air streaks (3–4 additive planes behind the knight), a short FOV kick, a whoosh, the cape snapping flat, and the somersault reused as the dash pose.

## 3. Real combat audio from free sources

The enemy sounds are synthesised beeps. Replace them with CC0 / CC-BY files and keep the synth as fallback if a file fails to load.
- Sources: OpenGameArt.org (filter CC0), Kenney.nl "Impact Sounds" / "RPG Audio" packs (CC0), freesound.org CC0 only. Record each file's title, author, licence and URL in `audio/CREDITS.txt`. Nothing without a clear licence.
- Needed set (short, punchy, mono OK): sword whoosh ×3, flesh hit ×3, shield block clang ×2, parry ring, heavy impact/thud, goblin grunt ×3, goblin hurt ×3, goblin death ×2, brute roar, stone-throw whip, stone hit, Warden roar, Warden slam, footstep on grass ×4, jump, land, dash whoosh, gem chime, heart, shrine.
- Implementation: an `audio/manifest.json` mapping names → files; `audio.js` preloads into `AudioBuffer`s on `initAudio()` (fetch + `decodeAudioData`), `sfx(name)` picks a random variant with ±6 % pitch and ±2 dB gain so repeats never sound identical; per-name rate limits stay. Add Settings → "Sound source: Files / Synth".
- Give enemies **voice**: a grunt on attack windup, a hurt bark on hit, a death cry, and idle chatter for goblins every 6–12 s when the player is within 12 m (quiet, so the camp sounds alive).

## 4. A grounded, believable level (nothing floats, nothing is "wooden boxes")

Daniel's screenshot: the hollow-tree climb reads as wooden boxes bolted to a trunk. Rebuild the climb and audit everything else:
- **Replace the branch platforms** with organic branches: tapered `CylinderGeometry` limbs that grow OUT of the trunk (base radius 0.9 → tip 0.35), curve upward with 2–3 segments, and carry a flattened knot at the walkable point; leaves clumped at the tips. Collision stays an AABB on the flat knot only. No box slabs anywhere on the tree.
- **Crumbling stone → rotten branches**: a branch that cracks (shake, a snap sound) and swings down, not a plank that drops.
- **Movers**: the floating rune-stones are the last floating thing. Replace with a **rope-and-plank bridge** across the gorge (static, sagging catenary of planks, ropes, posts at both ends) plus one **swinging log** on chains from a big overhead branch as the moving element. Collision for the bridge is a chain of small AABBs following the sag.
- **Audit script**: write `tools/ground-audit.mjs` (or an `ERRANT.audit()` function) that, for every static prop group, casts down from its origin and reports props whose base is more than 0.3 m above the nearest collision box top. The audit must print zero offenders before the job is done. Also check every collision box has visible geometry within 0.2 m of its top (no invisible floors) and every visible platform top has a box (no fake floors).
- Trees never intersect walkable boxes; ferns and mushrooms sit ON the ground chunk, not at chunk origin height when the chunk is a stump.

## 5. More forest

Make it read as a deep wood from every angle:
- Ground: leaf litter (instanced small flat quads with a leaf sprite, brown/orange), fallen twigs, more ferns in clusters, moss on the north side of trunks, roots that break the ground surface (already there, make them bigger and more).
- Canopy: an overhead canopy layer (large leaf blobs at 12–18 m over the route, sparse enough that light shafts and sky peek through) so the player is IN the forest, not on a lawn beside it. Dappled light: a moving shadow texture on the sun via `sun.shadow` is not possible, so fake it with 4–6 slow-drifting soft dark blobs (low-opacity sprites on the ground, `depthWrite false`).
- Tree variety: birch (white bark with dark ticks), dead snag, a fallen giant with a walk-through hollow, willow at the gorge.
- Life: butterflies (2-quad flappers on random paths), a deer that bolts when the player nears, crows that lift off from the palisade, fireflies only near the ravine mist at "dusk" areas.
- Sound: a forest bed (wind in leaves, distant birds) as a looping CC0 file under the music, quieter near the camp where the goblin chatter takes over.

---

## Definition of done
- Daniel confirms the noise is gone with music on.
- Jump + dash works on keyboard and gamepad; the tutorial teaches it; a scripted bot crosses every gap.
- Enemy and player combat sounds come from licensed files with a credits file; synth is only a fallback.
- `ERRANT.audit()` reports zero floating props and zero invisible or fake floors.
- The climb up the hollow tree is branches, not boxes; the gorge crossing is a bridge and a swinging log.
- Frame counter stays under 4 ms CPU at 1.5× DPR after the extra foliage (bake everything static; instanced for repeats).
- Update `errant-project.md` in memory and redeploy.
