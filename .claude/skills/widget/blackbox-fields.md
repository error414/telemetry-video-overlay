# INAV blackbox fields and bit masks — widget reference

Companion to `SKILL.md`. That file says **how a column is formatted in the CSV** (unit suffixes,
decoder `--unit-*` options); this one says **what the value means, where the firmware takes it
from, and how to decode the flag / enum columns**. Sources: INAV firmware
`src/main/blackbox/blackbox.c`, `fc/rc_modes.h` (`boxId_e`), `fc/runtime_config.h`
(`flightModeFlags_e`, `stateFlags_t`), `flight/failsafe.h`, `navigation/navigation.h`;
INAV Blackbox Explorer `flightlog_fields_presenter.js` ("Viewer" column); and the name tables read
out of the bundled `bin/blackbox-tools/bin/blackbox_decode.exe` ("CSV name" columns).

"In log" = what the firmware writes. "Viewer" = what the INAV Blackbox Explorer shows (not what
our CSV contains — the decoder converts only the columns listed in `SKILL.md`).

## Main frame (I/P frame, every logged loop iteration)

| Column | In log | Viewer | Meaning / source |
|---|---|---|---|
| `loopIteration` | – | – | Main PID loop iteration number. |
| `time` | µs | mm:ss.SSS | Time since FC boot (`micros()`). |
| `axisRate[0-2]` | °/s | °/s | Rotation **setpoint** (`axisPID_Setpoint`) — requested angular rate after rates/expo, not the gyro measurement. |
| `axisP/I/D/F[0-2]` | unitless | – | Roll/pitch/yaw PID contributions in mixer output scale. F = feedforward. D only logged when the D gain is non-zero. |
| `fwAltP/I/D`, `fwAltOut` | 0.1° (pitch) | – | Fixed-wing altitude controller (`nav_pids->fw_alt`): requested pitch in decidegrees; `Out` = constrained output. FW + active nav only. |
| `fwPosP/I/D`, `fwPosOut` | 0.1° (roll) | – | Fixed-wing 2D navigation controller (`fw_nav`): requested roll in decidegrees. |
| `fwAutoSpeedP/I` | µs | – | Throttle correction of the auto-speed (cruise throttle) controller. |
| `mcPosAxisP[0-2]` | cm/s | – | Multirotor position P controller: output = requested velocity. |
| `mcVelAxisP/I/D/FF[0-2]` | cm/s² | – | Multirotor velocity PID contributions = requested acceleration. |
| `mcVelAxisOut[0-2]` | cm/s² (Z: µs) | – | Constrained velocity PID output; on Z converted to a throttle adjustment in µs. |
| `mcSurfaceP/I/D`, `mcSurfaceOut` | – (÷10) | – | Surface-following (rangefinder) altitude controller, values divided by 10. |
| `rcData[0-3]` | µs 1000–2000 | µs | Raw RC channels from the receiver (roll, pitch, yaw, throttle) before expo/deadband. |
| `rcCommand[0-2]` | ±500 | – | Roll/pitch/yaw command after deadband and expo. |
| `rcCommand[3]` | µs (minthrottle–maxthrottle) | % | Throttle command; the viewer shows it as a percentage of the range. |
| `vbat` | 0.01 V | V | **Raw** (only filtered) battery voltage, no sag compensation (that is `sagCompensatedVBat`). |
| `amperage` | 0.01 A | A | Current from the sensor (or virtual / ESC telemetry), filtered. |
| `magADC[0-2]` | a.u. | – | Compass after calibration: `(raw − magZero) × 1024 / magGain`. Unitless; only the ratio between axes matters. |
| `BaroAlt` | cm | m | **Hardware baro value, not the estimator**: pressure→altitude (ISA) minus ground reference from arming + sensor temperature compensation. The fused altitude is `navPos[2]`. |
| `AirSpeed` | cm/s | – | `getAirspeedEstimate()`: calibrated pitot, or virtual airspeed from GPS + wind when no pitot. |
| `surfaceRaw` | cm | – | Raw rangefinder reading **without tilt correction**; −1 = out of range. |
| `rssi` | 0–1023 | % | Scaled RSSI, 1023 = 100 %. |
| `gyroADC[0-2]` | °/s | °/s | Gyro **after all filters** (LPF, notch, dynamic notch) — what feeds the PID loop. |
| `gyroRaw[0-2]` | °/s | °/s | Unfiltered gyro (scale only). Only with `blackbox_include_flags` RAW_GYRO. |
| `gyroPeakRoll/Pitch/Yaw[0-2]` | Hz | – | Frequencies of the 3 peaks found by the dynamic notch (matrix filter) per axis. |
| `accSmooth[0-2]` | LSB (`acc_1G` = 1 g) | g | Filtered accelerometer in raw units; the viewer divides by `acc_1G` from the header. |
| `accVib` | LSB | – | Vibration level = RMS deviation of acc from its filtered value. |
| `attitude[0-2]` | 0.1° | ° | AHRS attitude estimate (roll, pitch, yaw/heading 0–3600). This **is** the fusion output (IMU + compass/GPS). |
| `debug[0-7]` | per `debug_mode` | per mode | Meaning and unit defined by the configured `debug_mode` (in the log header). |
| `motor[0-7]` | µs | % | Mixer output to the motors (mapped into the µs range even for DSHOT). |
| `servo[0-25]` | µs | µs | Servo outputs after the mixer. |
| `navState` | enum | name | `navigationPersistentId_e`, see the table below. **Raw integer in our CSV.** |
| `navFlags` | bitmask | names | Estimator/controller flags, see below. **Raw integer in our CSV.** |
| `navEPH` / `navEPV` | cm | m | Estimator position error estimate, horizontal / vertical. |
| `navPos[0-2]` | cm | m | Estimated NEU position from the **position estimator** (GPS + baro + acc fusion); `[2]` = fused altitude (compare with `BaroAlt`). |
| `navVel[0-2]` | cm/s | m/s, km/h… (Z always m/s) | Estimated NEU velocity from the estimator. |
| `navTgtVel[0-2]` | cm/s | ditto | Velocity requested by the navigation controller. |
| `navTgtPos[0-2]` | cm | m | Navigation target position (waypoint, RTH point, hold position). |
| `navTgtHdg` | 0.01° | ° | Requested navigation heading (0–36000). |
| `navSurf` | cm | – | Estimated height above surface (AGL) from the estimator (rangefinder fusion). |
| `navAcc[0-2]` | cm/s² | – | NEU earth-frame acceleration from the estimator (gravity-compensated, rotated by attitude). |

## GPS frame (G frame)

| Column | In log | Viewer | Meaning / source |
|---|---|---|---|
| `time` | µs | – | Time the G frame was written. |
| `GPS_fixType` | enum | – | 0 = no fix, 1 = 2D, 2 = 3D. |
| `GPS_numSat` | count | – | Number of satellites. |
| `GPS_coord[0-1]` | ° × 10⁷ | ° | Lat / lon straight from the GPS (delta-from-home encoded in the log; **degrees in our CSV**). |
| `GPS_altitude` | **m** | m | MSL altitude from the GPS; the firmware keeps cm but **logs `llh.alt / 100`**. |
| `GPS_speed` | cm/s | m/s, km/h, mph | Ground speed from the GPS. |
| `GPS_ground_course` | 0.1° | ° | Course over ground (COG) from the GPS (**degrees in our CSV**). |
| `GPS_hdop` | HDOP × 100 | – | Horizontal dilution of precision. |
| `GPS_eph` / `GPS_epv` | cm | – | Horizontal / vertical accuracy reported by the GPS. |
| `GPS_velned[0-2]` | cm/s | – | North / East / Down velocities straight from the GPS (D positive down). |

## Home frame (H frame)

| Column | In log | Meaning |
|---|---|---|
| `GPS_home[0-1]` | ° × 10⁷ | Home lat / lon — reference for the delta encoding of `GPS_coord`. The decoder emits it as `GPS_home_lat`, `GPS_home_lon` in degrees. |

## Slow frame (S frame — written on change / periodically; value holds between samples)

| Column | In log | Viewer | Meaning / source |
|---|---|---|---|
| `activeWpNumber` | number | – | Active mission waypoint. |
| `flightModeFlags` | bitmask | names | **RC boxmodes** — what is *selected* on the transmitter, first 32 bits of `boxId_e` (name kept for compatibility). HEADING HOLD is also set when navigation controls heading automatically. |
| `flightModeFlags2` | bitmask | names | Next 32 bits of `boxId_e`. **Merged into the `flightModeFlags` column by the decoder.** |
| `activeFlightModeFlags` | bitmask | names | Flight modes **actually active** (`flightModeFlags_e`), not the RC selections — e.g. ANGLE forced by failsafe shows up here, not in `flightModeFlags`. **Raw integer in our CSV.** |
| `stateFlags` | bitmask | names | `stateFlags_t`: GPS_FIX, GPS_FIX_HOME, SMALL_ANGLE, AIRPLANE, LANDING_DETECTED… |
| `failsafePhase` | enum | name | Failsafe state machine phase. |
| `rxSignalReceived` | 0/1 | – | Receiver is getting a signal. |
| `rxFlightChannelsValid` | 0/1 | – | Flight channels hold valid (non-failsafe) values. |
| `rxUpdateRate` | Hz | Hz | Detected RC link update rate (rc smoothing). |
| `hwHealthStatus` | packed bits | decoded | 2 bits per sensor from the bottom: gyro, acc, compass, baro, GPS, rangefinder, pitot (0 = none, 1 = OK, 2 = unavailable, 3 = unhealthy). **Raw integer in our CSV.** |
| `powerSupplyImpedance` | mΩ | – | Calculated battery internal resistance (used for sag compensation). |
| `sagCompensatedVBat` | 0.01 V | V | Voltage recalculated to "no load": vbat + `I × R` from the impedance. **Stays 0.01 V in our CSV.** |
| `wind[0-2]` | cm/s | m/s, km/h… (Z m/s) | Wind estimate in the earth frame (wind estimator; fixed wing only, otherwise 0). |
| `mspOverrideFlags` | bitmask | – | bit 1 = MSP RC override active, bit 0 = override in failsafe. |
| `IMUTemperature` | 0.1 °C | °C | Gyro/IMU temperature; −1250 = invalid. |
| `baroTemperature` | 0.1 °C | °C | Baro sensor temperature (also used for the `BaroAlt` compensation); −1250 = invalid. |
| `sens0Temp`–`sens7Temp` | 0.1 °C | °C | External temperature sensors (DS18B20 etc.). |
| `escRPM` | RPM | – | From ESC telemetry, converted from eRPM by pole count, averaged across all ESCs. |
| `escTemperature` | °C | ⚠ viewer ÷10 | Highest ESC temperature. Firmware logs whole °C; the Blackbox Explorer wrongly divides by 10. Our CSV has the true °C. |
| `terrainAGL` | cm | – | Height above terrain from the **terrain database** (map + estimated position), not the rangefinder; `INT32_MIN`/0 when no data. |
| `terrainAMSL` | cm | – | Terrain elevation below the aircraft from the terrain database; `INT32_MIN` when no data. |

## How the flag / enum columns look in our CSV

The app runs the decoder with the default `--unit-flags flags`, and the decoder has name tables
**only** for `flightModeFlags` (+`flightModeFlags2`), `stateFlags` and `failsafePhase`:

| Column in CSV | Content | Read with |
|---|---|---|
| `flightModeFlags (flags)` | text, active names joined by `\|`, e.g. `ARM\|ANGLE\|NAVRTH`; `0` when nothing is set. Names of **both** words (boxId 0–59) in this one column | `ctx.raw(...)` → string, `split('\|')` |
| `stateFlags (flags)` | text, same format, e.g. `GPS_FIX_HOME\|GPS_FIX\|SMALL_ANGLE\|AIRPLANE` | `ctx.raw` |
| `failsafePhase (flags)` | one text name, e.g. `IDLE` | `ctx.raw` |
| `activeFlightModeFlags`, `navState`, `navFlags`, `hwHealthStatus`, `mspOverrideFlags` | **plain integers** (no suffix), decode with the masks below | `ctx.raw(...)` → number |

With `--unit-flags raw` (Files tab) the first three are integers too, so a robust widget handles
both: a string → split names, a number → test bits. Use the **CSV name** column of the tables to
match text, the **mask** column to test numbers.

```js
// ---- flags helper: works for the text form and the numeric form ----
function flagSet(v, csvName, bit) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && isNaN(v)) return v.split('|').indexOf(csvName) >= 0;
  return Math.floor(Number(v) / Math.pow(2, bit)) % 2 === 1;   // safe for bit 31 and for the merged 64-bit word
}
var fm  = ctx.raw('flightModeFlags (flags)');
var afm = ctx.raw('activeFlightModeFlags');       // number
var rthSelected = flagSet(fm, 'NAVRTH', 8);        // boxmode switched on
var rthActive   = flagSet(afm, null, 4);           // navigation really in RTH
var armed       = flagSet(fm, 'ARM', 0);
var sensorState = function (hw, idx) { return Math.floor(Number(hw) / Math.pow(4, idx)) % 4; }; // 0 gyro,1 acc,2 mag,3 baro,4 gps,5 rangefinder,6 pitot → 0 none,1 OK,2 unavailable,3 unhealthy
```

`flightModeFlags` is only the RC selection: a NAVRTH switch left on while the model is
disarmed still shows `NAVRTH`. For "what the aircraft is doing now" use `activeFlightModeFlags`
(and `navState`); for failsafe use `failsafePhase` / `activeFlightModeFlags` bit 9.

## `flightModeFlags` — RC boxmodes, word 1 (boxId 0–31, mask = 1 << bit)

| bit | mask | boxId (INAV) | CSV name | meaning |
|---|---|---|---|---|
| 0 | 0x00000001 | ARM | `ARM` | armed |
| 1 | 0x00000002 | ANGLE | `ANGLE` | self-levelling mode |
| 2 | 0x00000004 | HORIZON | `HORIZON` | |
| 3 | 0x00000008 | NAV ALTHOLD | `NAVALTHOLD` | altitude hold |
| 4 | 0x00000010 | HEADING HOLD | `HEADINGHOLD` | heading hold; also set automatically while navigation controls heading |
| 5 | 0x00000020 | HEADFREE | `HEADFREE` | |
| 6 | 0x00000040 | HEADADJ | `HEADADJ` | set headfree reference |
| 7 | 0x00000080 | CAMSTAB | `CAMSTAB` | camera stabilisation |
| 8 | 0x00000100 | NAV RTH | `NAVRTH` | return to home |
| 9 | 0x00000200 | NAV POSHOLD | `NAVPOSHOLD` | position hold |
| 10 | 0x00000400 | MANUAL | `MANUAL` | direct control, no stabilisation |
| 11 | 0x00000800 | BEEPER ON | `BEEPERON` | |
| 12 | 0x00001000 | LEDLOW | `LEDLOW` | LEDs off |
| 13 | 0x00002000 | LIGHTS | `LIGHTS` | |
| 14 | 0x00004000 | NAV LAUNCH | `NAVLAUNCH` | fixed-wing autolaunch |
| 15 | 0x00008000 | OSD OFF | `OSD` | OSD off |
| 16 | 0x00010000 | TELEMETRY | `TELEMETRY` | telemetry switch |
| 17 | 0x00020000 | BLACKBOX | `BLACKBOX` | logging on |
| 18 | 0x00040000 | FAILSAFE | `FAILSAFE` | forced failsafe |
| 19 | 0x00080000 | NAV WP | `NAVWP` | waypoint mission |
| 20 | 0x00100000 | AIRMODE | `AIRMODE` | |
| 21 | 0x00200000 | HOME RESET | `HOMERESET` | reset home position |
| 22 | 0x00400000 | GCS NAV | `GCSNAV` | ground-station control |
| 23 | 0x00800000 | (unused) | `**REMOVED**` | was KILLSWITCH; older decoder tables still print `KILLSWITCH` |
| 24 | 0x01000000 | SURFACE | `SURFACE` | altitude above surface (sonar / lidar) |
| 25 | 0x02000000 | FLAPERON | `FLAPERON` | |
| 26 | 0x04000000 | TURN ASSIST | `TURNASSIST` | |
| 27 | 0x08000000 | AUTOTRIM | `AUTOTRIM` | servo autotrim |
| 28 | 0x10000000 | AUTOTUNE | `AUTOTUNE` | |
| 29 | 0x20000000 | CAMERA 1 | `CAMERA1` | |
| 30 | 0x40000000 | CAMERA 2 | `CAMERA2` | |
| 31 | 0x80000000 | CAMERA 3 | `CAMERA3` | |

## `flightModeFlags2` — word 2 (boxId 32–61, bit = boxId − 32, mask = 1 << (boxId − 32))

| bit | mask | boxId | INAV mode | CSV name | meaning |
|---|---|---|---|---|---|
| 0 | 0x00000001 | 32 | OSD ALT 1 | `OSDALT1` | alternative OSD layout 1 |
| 1 | 0x00000002 | 33 | OSD ALT 2 | `OSDALT2` | |
| 2 | 0x00000004 | 34 | OSD ALT 3 | `OSDALT3` | |
| 3 | 0x00000008 | 35 | NAV COURSE HOLD | `NAVCOURSEHOLD` | course hold |
| 4 | 0x00000010 | 36 | MC BRAKING | `BRAKING` | multirotor braking |
| 5 | 0x00000020 | 37 | USER 1 | `USER1` | |
| 6 | 0x00000040 | 38 | USER 2 | `USER2` | |
| 7 | 0x00000080 | 39 | FPV ANGLE MIX | `FPVANGLEMIX` | |
| 8 | 0x00000100 | 40 | LOITER CHANGE | `LOITERDIRCHN` | change loiter direction |
| 9 | 0x00000200 | 41 | MSP RC OVERRIDE | `MSPRCOVERRIDE` | |
| 10 | 0x00000400 | 42 | PREARM | `PREARM` | |
| 11 | 0x00000800 | 43 | TURTLE | `TURTLE` | flip-over after crash |
| 12 | 0x00001000 | 44 | NAV CRUISE | `NAVCRUISE` | course hold + althold |
| 13 | 0x00002000 | 45 | AUTO LEVEL TRIM | `AUTOLEVEL` | automatic level trim |
| 14 | 0x00004000 | 46 | WP PLANNER | `PLANWPMISSION` | on-the-fly mission planning |
| 15 | 0x00008000 | 47 | SOARING | `SOARING` | thermal soaring |
| 16 | 0x00010000 | 48 | USER 3 | `USER3` | |
| 17 | 0x00020000 | 49 | USER 4 | `USER4` | |
| 18 | 0x00040000 | 50 | MISSION CHANGE | `CHANGEMISSION` | switch stored mission |
| 19 | 0x00080000 | 51 | BEEPER MUTE | `BEEPERMUTE` | |
| 20 | 0x00100000 | 52 | MULTI FUNCTION | `MULTIFUNCTION` | |
| 21 | 0x00200000 | 53 | MIXER PROFILE 2 | `MIXERPROFILE` | mixer profile switch (VTOL) |
| 22 | 0x00400000 | 54 | MIXER TRANSITION | `MIXERTRANSITION` | VTOL transition |
| 23 | 0x00800000 | 55 | ANGLE HOLD | `ANGLEHOLD` | |
| 24 | 0x01000000 | 56 | GIMBAL TILT LOCK | `GIMBALTLOCK` | |
| 25 | 0x02000000 | 57 | GIMBAL ROLL LOCK | `GIMBALRLOCK` | |
| 26 | 0x04000000 | 58 | GIMBAL CENTER | `GIMBALCENTER` | |
| 27 | 0x08000000 | 59 | GIMBAL HEADTRACKER | `GIMBALHTRK` | |
| 28 | 0x10000000 | 60 | AUTO SPEED | (no name in the decoder) | |
| 29 | 0x20000000 | 61 | TERRAIN AGL HOLD | (no name in the decoder) | altitude above terrain |

## `activeFlightModeFlags` — modes actually active (`flightModeFlags_e`; **integer in the CSV**)

| bit | mask | mode | meaning |
|---|---|---|---|
| 0 | 0x00000001 | ANGLE | self-levelling active |
| 1 | 0x00000002 | HORIZON | |
| 2 | 0x00000004 | HEADING HOLD | |
| 3 | 0x00000008 | NAV ALTHOLD | |
| 4 | 0x00000010 | NAV RTH | return to home running |
| 5 | 0x00000020 | NAV POSHOLD | |
| 6 | 0x00000040 | HEADFREE | |
| 7 | 0x00000080 | NAV LAUNCH | fixed-wing autolaunch |
| 8 | 0x00000100 | MANUAL | |
| 9 | 0x00000200 | FAILSAFE | failsafe active |
| 10 | 0x00000400 | AUTOTUNE | |
| 11 | 0x00000800 | NAV WP | waypoint mission |
| 12 | 0x00001000 | NAV COURSE HOLD | |
| 13 | 0x00002000 | FLAPERON | |
| 14 | 0x00004000 | TURN ASSIST | |
| 15 | 0x00008000 | TURTLE | |
| 16 | 0x00010000 | SOARING | |
| 17 | 0x00020000 | ANGLE HOLD | |
| 18 | 0x00040000 | NAV FW AUTOLAND | fixed-wing automatic landing |
| 19 | 0x00080000 | NAV SEND TO | fly to a given position |

Note the **different bit order** from `flightModeFlags`: there is no ARM bit here (armed =
`ARM` in `flightModeFlags`), and RTH is bit 4 here but bit 8 there.

## `stateFlags` — firmware state (`stateFlags_t`)

| bit | mask | CSV name | meaning |
|---|---|---|---|
| 0 | 0x00000001 | `GPS_FIX_HOME` | home position stored |
| 1 | 0x00000002 | `GPS_FIX` | valid GPS fix |
| 2 | 0x00000004 | `CALIBRATE_MAG` | compass calibration running |
| 3 | 0x00000008 | `SMALL_ANGLE` | level enough to arm |
| 4 | 0x00000010 | `FIXED_WING_LEGACY` | old fixed-wing flag |
| 5 | 0x00000020 | `ANTI_WINDUP` | controller anti-windup active |
| 6 | 0x00000040 | `FLAPERON_AVAILABLE` | flaperon configured |
| 7 | 0x00000080 | `NAV_MOTOR_STOP_OR_IDLE` | navigation requests motor stop / idle |
| 8 | 0x00000100 | `COMPASS_CALIBRATED` | |
| 9 | 0x00000200 | `ACCELEROMETER_CALIBRATED` | |
| 10 | 0x00000400 | `PWM_DRIVER_AVAILABLE` | firmware meaning today: **GPS ESTIMATED FIX** (estimated fix without a real one); the decoder still prints the old name |
| 11 | 0x00000800 | `NAV_CRUISE_BRAKING` | |
| 12 | 0x00001000 | `NAV_CRUISE_BRAKING_BOOST` | |
| 13 | 0x00002000 | `NAV_CRUISE_BRAKING_LOCKED` | |
| 14 | 0x00004000 | `NAV_EXTRA_ARMING_SAFETY_BYPASSED` | |
| 15 | 0x00008000 | `AIRMODE_ACTIVE` | airmode really active |
| 16 | 0x00010000 | `ESC_SENSOR_ENABLED` | ESC telemetry on |
| 17 | 0x00020000 | `AIRPLANE` | platform: airplane |
| 18 | 0x00040000 | `MULTIROTOR` | platform: multirotor |
| 19 | 0x00080000 | `ROVER` | platform: rover |
| 20 | 0x00100000 | `BOAT` | platform: boat |
| 21 | 0x00200000 | `ALTITUDE_CONTROL` | platform can control altitude / fly |
| 22 | 0x00400000 | `MOVE_FORWARD_ONLY` | rover / boat / fixed wing |
| 23 | 0x00800000 | `SET_REVERSIBLE_MOTORS_FORWARD` | |
| 24 | 0x01000000 | `FW_HEADING_USE_YAW` | fixed wing steers heading with yaw |
| 25 | 0x02000000 | `ANTI_WINDUP_DEACTIVATED` | |
| 26 | 0x04000000 | `LANDING_DETECTED` | landing detected |
| 27 | 0x08000000 | `IN_FLIGHT_EMERG_REARM` | emergency in-flight re-arm |
| 28 | 0x10000000 | `TAILSITTER` | tailsitter (pitch offset 90°) |

## `failsafePhase` (`failsafePhase_e`; text in the CSV)

| value | CSV name |
|---|---|
| 0 | `IDLE` |
| 1 | `RX_LOSS_DETECTED` |
| 2 | `RX_LOSS_IDLE` |
| 3 | `RETURN_TO_HOME` |
| 4 | `LANDING` |
| 5 | `LANDED` |
| 6 | `RX_LOSS_MONITORING` |
| 7 | `RX_LOSS_RECOVERED` |

## `navFlags` (**integer in the CSV**)

| bit | meaning |
|---|---|
| 0 | altitude estimate trusted |
| 1 | AGL (surface) estimate trusted |
| 2 | position estimate trusted |
| 3 | terrain following enabled |
| 5 | heading estimate trusted |
| 6 | pilot is adjusting position |
| 7 | pilot is adjusting altitude |
| 8 | pilot is adjusting heading |

## `navState` (`navigationPersistentId_e`, **integer in the CSV**)

From INAV `navigation/navigation.h` (INAV 7/8; the decoder has no name table for it, so verify
against the firmware version of the log when a value looks odd):

| value | state |
|---|---|
| 0 | UNDEFINED |
| 1 | IDLE |
| 2 / 3 | ALTHOLD initialize / in progress |
| 6 / 7 | POSHOLD_3D initialize / in progress |
| 8 | RTH initialize |
| 9 | RTH climb to safe altitude |
| 10 | RTH head home |
| 11 | RTH hover prior to landing |
| 12 | RTH landing |
| 13 / 14 | RTH finishing / finished |
| 15 | WAYPOINT initialize |
| 16 | WAYPOINT pre-action |
| 17 | WAYPOINT in progress |
| 18 | WAYPOINT reached |
| 19 | WAYPOINT next |
| 20 | WAYPOINT finished |
| 21 | WAYPOINT RTH land |
| 22 / 23 / 24 | EMERGENCY LANDING initialize / in progress / finished |
| 25 | LAUNCH initialize |
| 26 | LAUNCH wait |
| 28 | LAUNCH in progress |
| 29 / 30 / 31 | COURSE HOLD initialize / in progress / adjusting |
| 32 / 33 / 34 | CRUISE initialize / in progress / adjusting |
| 35 | WAYPOINT hold time |
| 36 | RTH hover above home |
| 38 | RTH trackback |
| 39 / 40 / 41 | MIXER AUTOMATED TRANSITION initialize / in progress / abort |
| 42 | FW LANDING climb to loiter |
| 43 | FW LANDING loiter |
| 44 | FW LANDING approach |
| 45 | FW LANDING glide |
| 46 | FW LANDING flare |
| 47 | FW LANDING abort |
| 48 | SEND TO |

(4, 5, 27, 37 are retired ids.)

## Notes

- Axes `[0-2]` = roll / pitch / yaw for rate, PID, gyro and acc fields; for nav fields
  (`navPos`, `navVel`, `navAcc`, `navTgtVel`, `navTgtPos`, `wind`) = North / East / Up, for
  `GPS_velned` North / East / Down.
- The log encoding (deltas, predictors) is compression only; the decoder restores the original
  values. Units change only through the decoder `--unit-*` options (see `SKILL.md`).
- Conditional fields: `fw*` only fixed wing with active navigation, `mc*` only multirotor,
  `gyroRaw` / `gyroPeak*` / `debug` only per `blackbox_include_flags` and `debug_mode`, sensor
  fields only when the sensor is present.
