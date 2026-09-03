/**
 * Registry of automatic sync methods offered when the Auto sync dialog opens.
 *
 * A method estimates the telemetry offset (and drift) and hands back the same
 * {offset0, drift} fit, so the dialog's result view and "apply" are shared. Adding
 * a method means: an entry here, a body/run branch in AutoSyncDialog.jsx and the
 * computation next to autoSync.js.
 *
 * 'gyroflow' is reserved: it will read the sync points (and later the stabilisation
 * data) from a Gyroflow project instead of analysing the footage here. Until that
 * exists it is listed but marked unavailable.
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
    label: 'Gyroflow data',
    hint: 'Takes the sync points from a Gyroflow project of this video. Not implemented yet.',
    available: false,
  },
];
