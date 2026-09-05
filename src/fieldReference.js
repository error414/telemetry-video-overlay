/**
 * INAV blackbox field reference shown behind the "?" mark of every column input.
 *
 * Pure data + matching helpers (Node-friendly, no React). "log" = the unit the firmware writes
 * (src/main/blackbox/blackbox.c), "viewer" = what the INAV Blackbox Explorer converts it to
 * (flightlog_fields_presenter.js). Descriptions use a two-token markup: **bold** and `code`.
 *
 * `key` is the field name as written in the reference, `[0-2]` = an index range and `A/B/C` =
 * alternative suffixes. `match` (a RegExp source, optional) overrides the automatic expansion of
 * that key into a pattern that recognises the concrete column names of a decoded log.
 */

export const FRAMES = [
  { id: 'main', letter: 'I/P', label: 'Main frame', note: 'every PID loop iteration (I = full, P = delta)' },
  { id: 'gps', letter: 'G', label: 'GPS frame', note: 'whenever the GPS delivers a new fix' },
  { id: 'home', letter: 'H', label: 'Home frame', note: 'home position, reference for GPS_coord' },
  { id: 'slow', letter: 'S', label: 'Slow frame', note: 'written on change / periodically' },
];

const main = (key, log, viewer, desc, match) => ({ frame: 'main', key, log, viewer, desc, match });
const gps = (key, log, viewer, desc, match) => ({ frame: 'gps', key, log, viewer, desc, match });
const home = (key, log, viewer, desc, match) => ({ frame: 'home', key, log, viewer, desc, match });
const slow = (key, log, viewer, desc, match) => ({ frame: 'slow', key, log, viewer, desc, match });

export const FIELDS = [
  // ---- main frame (I/P) ----
  main('loopIteration', '–', '–', 'Main PID loop iteration number.'),
  main('time', 'µs', 'mm:ss.SSS', 'Time since FC boot (`micros()`).'),
  main('axisRate[0-2]', '°/s', '°/s', 'Rotation **setpoint** (`axisPID_Setpoint`) – requested angular rate after applying rates, not the gyro measurement.'),
  main('axisP/I/D/F[0-2]', 'unitless', '–', 'Roll/pitch/yaw PID controller contributions in mixer output scale. F = feedforward. D is only logged when the D gain is non-zero.', '^axis[PIDF]\\[\\d+\\]$'),
  main('fwAltP/I/D, fwAltOut', '0.1° (pitch)', '–', 'Fixed-wing altitude controller (`nav_pids->fw_alt`): requested pitch in decidegrees; `Out` = constrained output. FW + active nav only.', '^fwAlt(P|I|D|Out)$'),
  main('fwPosP/I/D, fwPosOut', '0.1° (roll)', '–', 'Fixed-wing 2D navigation controller (`fw_nav`): requested roll in decidegrees (firmware divides centidegrees by 10).', '^fwPos(P|I|D|Out)$'),
  main('fwAutoSpeedP/I', 'µs', '–', 'Throttle correction of the auto-speed controller (cruise throttle).', '^fwAutoSpeed[PI]$'),
  main('mcPosAxisP[0-2]', 'cm/s', '–', 'Multirotor position P controller: output = requested velocity.'),
  main('mcVelAxisP/I/D/FF[0-2]', 'cm/s²', '–', 'Multirotor velocity PID: contributions = requested acceleration.', '^mcVelAxis(P|I|D|FF)\\[\\d+\\]$'),
  main('mcVelAxisOut[0-2]', 'cm/s² (Z→µs)', '–', 'Constrained velocity PID output; on the Z axis it is further converted to a throttle adjustment in µs.'),
  main('mcSurfaceP/I/D, mcSurfaceOut', '– (÷10)', '–', 'Surface-following altitude controller (rangefinder), values divided by 10.', '^mcSurface(P|I|D|Out)$'),
  main('rcData[0-3]', 'µs (1000–2000)', 'µs', 'Raw RC channels from the receiver (roll, pitch, yaw, throttle) before expo/deadband.'),
  main('rcCommand[0-2]', '±500', '–', 'Roll/pitch/yaw command after deadband and expo.', '^rcCommand\\[[0-2]\\]$'),
  main('rcCommand[3]', 'µs (minthrottle–maxthrottle)', '%', 'Throttle command. The viewer converts it to a percentage of the range.', '^rcCommand\\[3\\]$'),
  main('vbat', '0.01 V', 'V', '**Raw** (only filtered) battery voltage from ADC/telemetry – without sag compensation (that is `sagCompensatedVBat`).', '^vbat(Latest)?$'),
  main('amperage', '0.01 A', 'A', 'Current from the current sensor (or virtual/ESC telemetry), filtered.', '^amperage(Latest)?$'),
  main('magADC[0-2]', 'a.u.', '–', 'Compass after calibration: `(raw − magZero) × 1024 / magGain`. Unitless; the ratio between axes is what matters.'),
  main('BaroAlt', 'cm', 'm', '**HW baro value, not from the position estimator**: pressure→altitude (ISA) minus ground reference from calibration at arming + sensor temperature compensation (`applySensorTempCompensation`). The fused altitude is `navPos[2]`.'),
  main('AirSpeed', 'cm/s', '–', '`getAirspeedEstimate()`: calibrated pitot, or virtual airspeed from GPS+wind when no pitot is present.'),
  main('surfaceRaw', 'cm', '–', 'Raw rangefinder reading **without tilt correction**; −1 = out of range.'),
  main('rssi', '0–1023', '%', 'Scaled RSSI (`getRSSI`), 1023 = 100 %.'),
  main('gyroADC[0-2]', '°/s', '°/s', 'Gyro **after all filters** (LPF, notch, dynamic notch) – what feeds the PID loop.'),
  main('gyroRaw[0-2]', '°/s', '°/s', 'Unfiltered gyro (scale only). Only logged with `blackbox_include_flags` RAW_GYRO.'),
  main('gyroPeakRoll/Pitch/Yaw[0-2]', 'Hz', '–', 'Frequencies of the 3 peaks detected by the dynamic notch filter (matrix filter) for the given axis.', '^gyroPeak(Roll|Pitch|Yaw)\\[\\d+\\]$'),
  main('accSmooth[0-2]', 'LSB (acc_1G = 1 g)', 'g', 'Filtered accelerometer in raw units; the viewer divides by `acc_1G` from the header → g.'),
  main('accVib', 'LSB (same scale)', '–', 'Vibration level = RMS of the acc deviation from its filtered value (`accGetVibrationLevel`).'),
  main('attitude[0-2]', '0.1°', '°', 'Attitude estimate from the AHRS (roll, pitch, yaw/heading 0–3600). This **is** the fusion output (IMU+compass/GPS).'),
  main('debug[0-7]', 'per debug_mode', 'per mode', 'Meaning and units are defined by the configured `debug_mode` (stored in the log header).'),
  main('motor[0-7]', 'µs', '%', 'Mixer output to the motors (mapped into the µs range even for DSHOT).'),
  main('servo[0-25]', 'µs', 'µs', 'Servo outputs after the mixer.'),
  main('navState', 'enum', 'name', '`navigationPersistentId_e` – current state of the navigation state machine (IDLE, RTH_*, WP_*, …).'),
  main('navFlags', 'bitmask', 'names', 'bit0 alt trusted, bit1 AGL trusted, bit2 pos trusted, bit3 terrain follow, bit5 heading trusted, bit6/7/8 pilot adjusting position/altitude/heading.'),
  main('navEPH / navEPV', 'cm', 'm (÷100)', 'Estimator position error estimate – horizontal / vertical.', '^navEP[HV]$'),
  main('navPos[0-2]', 'cm', 'm', 'Estimated NEU position from the **position estimator** (GPS+baro+acc fusion); `[2]` = fused altitude (compare with `BaroAlt`).'),
  main('navVel[0-2]', 'cm/s', 'm/s, km/h… per settings (Z always m/s)', 'Estimated NEU velocity from the position estimator.'),
  main('navTgtVel[0-2]', 'cm/s', 'ditto', 'Requested velocity of the navigation controller.'),
  main('navTgtPos[0-2]', 'cm', 'm', 'Navigation target position (waypoint, RTH point, hold position).'),
  main('navTgtHdg', '0.01°', '°', 'Requested navigation heading (0–36000).'),
  main('navSurf', 'cm', '–', 'Estimated height above surface (AGL) from the estimator (rangefinder fusion).'),
  main('navAcc[0-2]', 'cm/s²', '–', 'Acceleration in the NEU earth frame from the estimator (gravity-compensated, rotated by attitude).'),

  // ---- GPS frame (G) ----
  gps('time', 'µs', '–', 'Time the G frame was written.', '^time$'),
  gps('GPS_fixType', 'enum', '–', '0 = no fix, 1 = 2D, 2 = 3D.'),
  gps('GPS_numSat', 'count', '–', 'Number of satellites.'),
  gps('GPS_coord[0-1]', '° × 10⁷', '°', 'Lat/lon straight from the GPS (stored as delta from home in the log).'),
  gps('GPS_altitude', '**m**', 'm', 'MSL altitude from the GPS – the firmware keeps it in cm but **writes it to the log divided by 100** (`llh.alt / 100`). A typical example of a unit change.'),
  gps('GPS_speed', 'cm/s', 'm/s, km/h or mph per viewer settings', 'Ground speed from the GPS.'),
  gps('GPS_ground_course', '0.1°', '°', 'Course over ground (COG) from the GPS.'),
  gps('GPS_hdop', 'HDOP × 100', '–', 'Horizontal dilution of precision.'),
  gps('GPS_eph / GPS_epv', 'cm', '–', 'Horizontal/vertical accuracy reported by the GPS.', '^GPS_ep[hv]$'),
  gps('GPS_velned[0-2]', 'cm/s', '–', 'North/East/Down velocities straight from the GPS (D = positive down).'),

  // ---- home frame (H) ----
  home('GPS_home[0-1]', '° × 10⁷', '–', 'Home position lat/lon – reference for the delta encoding of `GPS_coord`.'),

  // ---- slow frame (S) ----
  slow('activeWpNumber', 'number', '–', 'Active mission waypoint.'),
  slow('flightModeFlags', 'bitmask', 'names', '**RC boxmodes** (what is selected on the transmitter), first 32 bits of `boxId_e`; name kept for compatibility. The HEADING HOLD bit is also set when navigation controls heading automatically.'),
  slow('flightModeFlags2', 'bitmask', 'names', 'Next 32 bits of `boxId_e`.'),
  slow('activeFlightModeFlags', 'bitmask', 'names', '**Actually active** flight modes (`flightModeFlags_e`) – not the RC selections; e.g. ANGLE forced by failsafe shows up here, not in `flightModeFlags`.'),
  slow('stateFlags', 'bitmask', 'names', '`stateFlags_t`: GPS_FIX, GPS_FIX_HOME, CALIBRATE_MAG, SMALL_ANGLE, FIXED_WING…'),
  slow('failsafePhase', 'enum', 'name', 'Failsafe state machine phase (IDLE, RX_LOSS_DETECTED, RETURN_TO_HOME, LANDED…).'),
  slow('rxSignalReceived', '0/1', '–', 'Receiver is getting a signal.'),
  slow('rxFlightChannelsValid', '0/1', '–', 'Flight channels hold valid values (not failsafe values).'),
  slow('rxUpdateRate', 'Hz', 'Hz', 'Detected RC link update rate (from rc_smoothing).'),
  slow('hwHealthStatus', 'packed bits', 'decoded', '2 bits per sensor from the bottom: gyro, acc, compass, baro, GPS, rangefinder, pitot (0 = none, 1 = OK, 2 = unavailable, 3 = unhealthy).'),
  slow('powerSupplyImpedance', 'mΩ', '–', 'Calculated battery internal resistance (used for sag compensation).'),
  slow('sagCompensatedVBat', '0.01 V', 'V', 'Voltage recalculated to "no load" – vbat + the `I × R` drop from the impedance.'),
  slow('wind[0-2]', 'cm/s', 'm/s, km/h… per settings (Z always m/s)', 'Wind estimate in the earth frame from the wind estimator (only works on FW, otherwise 0).'),
  slow('mspOverrideFlags', 'bitmask', '–', 'bit1 = MSP RC override active, bit0 = override in failsafe.'),
  slow('IMUTemperature', '0.1 °C', '°C', 'Gyro/IMU temperature; −1250 = invalid.'),
  slow('baroTemperature', '0.1 °C', '°C', 'Baro sensor temperature (also used for the `BaroAlt` temperature compensation); −1250 = invalid.'),
  slow('sens0Temp–sens7Temp', '0.1 °C', '°C', 'External temperature sensors (DS18B20 etc.).', '^sens[0-7]Temp$'),
  slow('escRPM', 'RPM', '–', 'RPM from ESC telemetry, converted from eRPM using the pole count, averaged across all ESCs.'),
  slow('escTemperature', '°C', '⚠ viewer divides by 10', 'Highest temperature from ESC telemetry. The firmware logs whole °C, but the viewer displays it divided by 10 like the other temperatures – the displayed value is 10× too small.'),
  slow('terrainAGL', 'cm', '–', 'Height above terrain from the **terrain database** (map data + estimated position), not from the rangefinder; `INT32_MIN`/0 when no data.'),
  slow('terrainAMSL', 'cm', '–', 'Terrain elevation below the aircraft from the terrain database; `INT32_MIN` when no data.'),
];

export const NOTES = [
  'Axes `[0-2]` = roll/pitch/yaw for rate/PID/gyro/acc fields; for nav fields (`navPos`, `navVel`, `navAcc`, `navTgtVel`, `navTgtPos`, `wind`) = North/East/Up (for `GPS_velned` North/East/Down).',
  "The log encoding (deltas, predictors) is compression only – the decoder restores the original values and does not change units. Units are only changed by the viewer's presentation layer according to the table and the user's velocity unit setting (m/s / km/h / mph).",
  'Conditional fields: `fw*` only fixed-wing with active navigation, `mc*` only multirotor, `gyroRaw`/`gyroPeak*`/`debug` only per `blackbox_include_flags` and `debug_mode`, sensor fields only when the sensor is present.',
];

// ---- matching decoded column names against the reference ----

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "axisRate[0-2]" -> /^axisRate\[\d+\]$/; an explicit `match` wins. */
export function fieldPattern(field) {
  if (field.match) return new RegExp(field.match);
  const src = escapeRe(field.key).replace(/\\\[\d+-\d+\\\]/g, '\\[\\d+\\]');
  return new RegExp('^' + src + '$');
}

/**
 * Bare field name of a decoded CSV column: drops the "file.csv:" disambiguation prefix and the
 * " (unit)" suffix blackbox_decode appends ("GPS_speed (m/s)" -> "GPS_speed").
 */
export function bareColumnName(column) {
  return column
    .replace(/^.*\.csv:/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/**
 * For every reference field the loaded columns it describes, in log order and without the
 * "file.csv:" duplicates (those are offered by the column dropdown anyway).
 * Returns Map<field, string[]>.
 */
export function matchColumns(columnNames) {
  const cols = columnNames.filter((c) => !/^.*\.csv:/i.test(c));
  const bare = cols.map(bareColumnName);
  const out = new Map();
  for (const f of FIELDS) {
    const re = fieldPattern(f);
    const hits = cols.filter((c, i) => re.test(bare[i]));
    if (hits.length) out.set(f, hits);
  }
  return out;
}

/** Case-insensitive filter over key, units and description; every word must match somewhere. */
export function filterFields(fields, query) {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  const words = q.split(/\s+/);
  return fields.filter((f) => {
    const hay = (f.key + ' ' + f.log + ' ' + f.viewer + ' ' + f.desc).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
