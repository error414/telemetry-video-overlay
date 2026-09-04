/**
 * Registry of automatic sync methods offered when the Auto sync dialog opens.
 *
 * A method estimates the telemetry offset (and drift) and hands back the same
 * {offset0, drift} fit, so the dialog's result view and "apply" are shared. Adding
 * a method means: an entry here, a body/run branch in AutoSyncDialog.jsx and the
 * computation next to autoSync.js.
 */
export const SYNC_METHODS = [
  {
    id: 'video-gyro',
    label: 'Video motion × gyro',
    hint: 'Tracks the camera rotation in six 6-second windows spread over the footage and finds where the gyro log moves the same way; the windows also give the clock drift. Needs unstabilised footage (RockSteady / HorizonSteady off).',
    available: true,
  },
  {
    id: 'gyroflow',
    label: 'Gyroflow project',
    hint: 'Reads the camera’s own gyro (DJI O3/O4, GoPro…) from a .gyroflow project saved for this video and matches it against the blackbox gyro. Exact and instant; works with stabilised footage too.',
    available: true,
  },
];
