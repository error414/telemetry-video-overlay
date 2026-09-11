import React from 'react';
import Stage from '../components/Stage.jsx';
import Transport from '../components/Transport.jsx';
import Timeline from '../components/Timeline.jsx';
import { usePlayer } from '../components/player.js';

/**
 * Shared skeleton of the four workflow steps: the stage with the video on the left (optional
 * toolbar above it, the play deck and timeline under it) and the step's own cards in the side
 * panel on the right. What the stage shows (widgets, edit handles, trace, export range) is
 * decided per step through props, so every step only carries what it needs.
 */
export default function StepScreen({ app, tools, children, editMode = false, showWidgets = true, trace = false, rangeMode = 'none', tail = null, empty = null }) {
  const { video, videoRef, time, setTime, playbackBlocked, proxyProgress, showPlayError, store, storeVersion, sync, range, setRange, markers, setMarkers, columnNames } = app;
  const player = usePlayer({
    video,
    videoRef,
    time,
    setTime,
    disabled: playbackBlocked && !(video && (video.proxy || video.liveProxy)),
    // while the live proxy is still encoding, seeking (and the export in/out points) is capped to the part ffmpeg has written
    seekLimit: video && video.liveProxy && !video.proxy && proxyProgress != null ? Math.max(0, proxyProgress * video.duration - 1) : undefined,
    setStatus: showPlayError,
  });
  const lockTitle = player.disabled ? 'Playback disabled until a preview proxy is created (Files step)' : undefined;
  return (
    <div className="workspace">
      <main className="workspace-main">
        {tools ? <div className="stage-tools">{tools}</div> : <div style={{ height: 16, flex: 'none' }} />}
        <div className="stage-well">
          <Stage
            video={video}
            videoRef={videoRef}
            widgets={app.widgets}
            store={store}
            storeVersion={storeVersion}
            sync={sync}
            time={time}
            setTime={setTime}
            range={range}
            selectedId={app.selectedId}
            setSelectedId={app.setSelectedId}
            updateWidget={app.updateWidget}
            editMode={editMode}
            grid={app.grid}
            layout={app.layout}
            setStatus={showPlayError}
            onOpenEditor={editMode ? app.openEditorFor : undefined}
            showWidgets={showWidgets}
            empty={empty}
          />
        </div>
        <div className="player">
          <Transport player={player} lockTitle={lockTitle} />
          <Timeline player={player} store={store} storeVersion={storeVersion} columnNames={columnNames} sync={sync} range={range} setRange={setRange} trace={trace} rangeMode={rangeMode} markers={markers} setMarkers={setMarkers} />
          {(tail || player.disabled || (player.limit < player.dur - 0.5 && !player.disabled)) && (
            <div className="player-tail">
              {player.limit < player.dur - 0.5 && !player.disabled && <span className="hint">encoded to {Math.floor(player.limit / 60)}:{String(Math.floor(player.limit % 60)).padStart(2, '0')}</span>}
              {player.disabled && <span className="chip chip-warn">playback locked — create a proxy</span>}
              {typeof tail === 'function' ? tail(player) : tail}
            </div>
          )}
        </div>
      </main>
      <aside className="workspace-side">{typeof children === 'function' ? children(player) : children}</aside>
    </div>
  );
}
