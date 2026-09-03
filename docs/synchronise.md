# Synchronising video and blackbox — what was found and how it works

Notes from the sync work of 2026-09-03 (branch `stabilization`, merged to `main`).
Everything measured here was measured on the user's own footage and logs; the numbers are
kept so they do not have to be re-measured.

## 1. The time model

```
telemetry time = video time × (1 + drift / 1000) + offset
```

- `offset` — seconds added to video time (telemetry time at video 0:00).
- `drift` — milliseconds of telemetry gained per second of video. The camera and the flight
  controller keep separate clocks and they run at slightly different rates; one offset
  cannot hold over a long flight.
- Implemented in `src/time.js` (`toTele`, `toVideo`, `syncScale`); used by the widget runtime
  (`renderWidget`, `exportRangeMs`), the export, the panels, the code editor preview and the
  timeline trace. The project file stores both `offset` and `drift` (missing `drift` = 0).
- Manual controls: the sync bar has the offset stepper (±0.01 / ±0.1 / ±1 s, `[` / `]` keys,
  "Start = here") and a drift stepper (±0.01 / ±0.1 ms/s). The footer shows `t`, `offset` and
  `drift` (when non-zero).

## 2. Auto sync — "Video motion × gyro"

`Auto sync…` in the sync bar. The dialog first asks for the method (*Video motion × gyro*
or *Gyroflow data* — the latter is reserved and does nothing yet, see `src/sync/methods.js`).

The video method (`src/sync/`):

1. **Gyro** — three angular-rate columns picked by the user (INAV: `gyroADC[0..2]`, any
   order, any unit). Only |ω| = √(x²+y²+z²) is used, so the axis order and the camera
   mounting do not matter (`gyroSignal.js`).
2. **Windows** — the video is split into six equal parts; in each part the window (6 s) with
   the strongest gyro activity (moving std of |ω|) is chosen, mapped to video time through
   the current sync. A second candidate per part is tried when the first cannot be tracked
   or matches below 0.9 (`AutoSyncDialog.jsx`, `planWindows`). The configurable version of
   this (window count, length, manual start, search band) was removed on request and is
   documented in `docs/auto-sync-window-options.md`.
3. **Frames** — the main process decodes the window from the *original* file with ffmpeg
   (CUDA when available) as 8-bit gray 480 px wide (`video:grayFrames` IPC). The frames are
   assumed to be at the constant rate ffprobe reports (`r_frame_rate`).
4. **Camera motion** — pyramidal Lucas-Kanade on a grid of points (spacing 20 px, window
   11×11, 4 levels, forward-backward check ≤ 0.75 px), then a robust similarity fit
   (rotation + translation + scale, iterated residual clipping) per frame pair. The centre
   shift and in-plane rotation give the yaw/pitch/roll increments up to the focal length;
   their norm in deg/s is compared with |gyro| (`videoMotion.js`). Runs in a worker.
5. **Correlation** — |gyro| is resampled to a grid of ¼ frame interval and box-filtered over
   one frame interval (optical flow measures the mean rate between frames); normalised
   cross-correlation over every offset in the whole log (coarse: one frame step, fine:
   ¼ frame, parabolic refinement). Six horizontal FOV candidates (60–160°) are tried and the
   best kept, because only the ratio of roll to pan depends on the lens (`correlate.js`,
   `autoSync.js`). "Ambiguous" is flagged when a competing peak outside the main peak's
   half-height width scores > 0.9 × the winner.
6. **Fit** — each window yields a local offset at its centre; a score-weighted line
   `offset(t) = offset0 + drift·t` through the windows with match ≥ 0.8 gives offset and
   drift. One usable window → offset only, drift unchanged. Windows further than 30 ms from
   the line are flagged ("windows disagree").

Timing: a 6 s window of 4K120 costs ≈ 5 s CUDA decode + 5 s tracking; six windows ≈ 35–70 s.
1080p60 goggles DVR: ≈ 20 s for six windows.

Requirements: unstabilised footage (RockSteady / HorizonSteady / Gyroflow output cannot be
used — the camera motion has been removed from it) and some rotation in the flight. Smooth
cruising with little rotation gives low matches; a window right after landing (hand-carrying,
log ending) can track well but match a wrong place — that is why low-match windows are
dropped from the fit.

## 3. Measurements on the user's flights (all from D:\bb4)

| flight | FC | video | offset at 0:00 | drift | matches |
|---|---|---|---|---|---|
| T1 | Matek H743-WLITE | `t1/DJI_…_0018_D_joined.MP4` (air unit, 4K 119.88 fps) + LOG00011 | 1.012 s | +0.042 ms/s (≈ 40 ppm) | 0.986–0.997 |
| T2 | iFlight Blitz H7 Wing | `t2/DJI_…_0034_D_joined.MP4` (air unit, 4K 119.88 fps) + LOG00006 | 1.065 s | +0.512 ms/s (≈ 510 ppm) | 0.998–0.999 |
| T1 | Matek H743-WLITE | `DJI_0083.MOV` (goggles DVR, 1080p 60 fps, OSD burnt in) + LOG00012 | 1.067 s | +1.025 ms/s (≈ 1000 ppm) | 0.991–0.999 |

Earlier saved projects used 0.7 s for T1/T2 — that was a rough manual value.

### What the drift is

- Both air-unit files and the DVR file have perfectly regular container timestamps
  (every frame exactly 1001/120000 s or 1/60 s, no gaps, checked with `ffprobe -show_packets`),
  so it is not dropped frames in the container.
- T2: a 4 s-window sweep every 20 s over the whole flight gives a perfectly straight line
  (1.078 s @ 20 s → 1.434 s @ 720 s) — a rate mismatch between the camera's and the
  flight controller's clock. T1 and T2 use the same kind of DJI unit but different flight
  controllers, and they differ by 12× (40 vs 510 ppm), so the Blitz H7 Wing's clock is the
  odd one. Which side is "right" cannot be told from the files.
- Goggles DVR (`DJI_0083.MOV`): the drift is ≈ 1.001, the NTSC factor — the goggles write
  the 59.94 fps stream from the air unit with 60.00 fps timestamps, so the content runs 0.1 %
  fast. This was confirmed independently of the motion analysis by OCR of the burnt-in OSD
  flight timer over the whole clip: the OSD timer itself gains 1.06 ms per video second
  (−0.35 s at the start, +0.21 s at the end relative to a uniform clock). The OSD moves with
  the image, so the drift the app measures is real for the OSD too.

### Why the drift can look wrong against the OSD

The DJI MSP-DisplayPort OSD refreshes only about every 0.4 s, so any OSD digit lags the
flight controller by 0–0.4 s and jumps. Comparing slowly changing OSD values (altitude,
terrain AGL) with a widget cannot resolve a 0.6 s difference — the value changes by a metre
in that time. To check the sync at the end of a long clip compare the OSD **flight timer**
with a widget showing the blackbox `time` column: with drift 0 the widget is ≈ 0.6 s behind
the OSD at the end of a 10-minute DVR clip; with the measured drift they agree up to the OSD
refresh jitter.

## 4. Practical notes

- The air-unit recording (4K) and the goggles DVR of the same flight need different drifts
  (0.04 vs 1.03 ms/s for T1) — the drift belongs to the video file, not to the flight.
- The auto sync compares only the magnitude of rotation; the gyro unit (deg/s, rad/s, raw)
  and the column order are irrelevant. The decoder's `--unit-rotation` setting does not
  matter.
- Everything the analysis needs is in the store's series (relative seconds); the CSV is
  decimated to ~120 Hz, which is enough for 120 fps video.
- Prototype outside the app: decode gray frames with ffmpeg and call `runVideoGyroSync`
  from `src/sync/autoSync.js` in Node (the modules have no DOM dependency).

## 5. Next step — Gyroflow

`src/sync/methods.js` lists `gyroflow` as a method. The plan is to read Gyroflow's sync
points (the same thing as this feature's per-window offsets) from a `.gyroflow` project and
feed them into the same offset/drift fit, and later its stabilisation data.
