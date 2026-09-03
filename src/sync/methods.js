/**
 * Registry of automatic sync methods shown in the Auto sync dialog.
 *
 * A method estimates the telemetry offset (seconds added to video time) and hands
 * back {offset, score} plus whatever it wants to show. The dialog switches its
 * body and its "run" logic on `id`, so adding a method means: an entry here, a
 * body/run branch in AutoSyncDialog.jsx and the computation next to autoSync.js.
 *
 * Planned: 'gyroflow' — take the offset (and later the stabilisation data) from a
 * Gyroflow project file instead of analysing the footage here.
 */
export const SYNC_METHODS = [
  {
    id: 'video-gyro',
    label: 'Video motion × gyro',
    hint: 'Tracks the camera rotation in a few seconds of footage and finds where the gyro log moves the same way. Needs unstabilised footage (RockSteady / HorizonSteady off).',
  },
];
