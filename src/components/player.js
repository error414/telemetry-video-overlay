import { useEffect, useRef, useState } from 'react';

const MUTED_KEY = 'telemetry-overlay.muted';

/**
 * Playback state shared by the transport buttons, the timeline and the keyboard shortcuts of a
 * step: play/pause, frame stepping, seeking (capped to the encoded part of a live proxy), mute.
 * One instance per step screen; Transport and Timeline take it as the `player` prop.
 */
export function usePlayer({ video, videoRef, time, setTime, disabled, seekLimit, setStatus }) {
  const dur = video ? video.duration : 0;
  const fps = video && video.fps ? video.fps : 30;
  const limit = seekLimit != null ? Math.min(dur, seekLimit) : dur;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, videoRef, video]);

  // keep the play/pause state in sync with what the element actually does — a source swap
  // (proxy finished, live proxy started) implicitly stops playback without a 'pause' event
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    v.addEventListener('play', on);
    v.addEventListener('pause', off);
    v.addEventListener('emptied', off);
    setPlaying(!v.paused && !v.ended);
    return () => {
      v.removeEventListener('play', on);
      v.removeEventListener('pause', off);
      v.removeEventListener('emptied', off);
    };
  }, [videoRef, video]);

  const seek = (t) => {
    if (disabled) return;
    const v = videoRef.current;
    t = Math.max(0, Math.min(limit, t));
    if (v) v.currentTime = t;
    setTime(t);
  };

  // Heavy files (e.g. HEVC 4K/120fps) can fail silently: play() resolves, no error/stalled event fires,
  // but the decoder never outputs a frame. Detect it by checking decoded-frame count shortly after play.
  const stallCheckRef = useRef(0);
  useEffect(() => () => clearTimeout(stallCheckRef.current), []);
  const armStallCheck = (v) => {
    const frames = () => (v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : -1);
    const f0 = frames();
    const t0 = v.currentTime;
    clearTimeout(stallCheckRef.current);
    stallCheckRef.current = setTimeout(() => {
      if (v !== videoRef.current || v.paused || v.ended) return;
      const dead = f0 >= 0 ? frames() === f0 : v.currentTime - t0 < 0.05;
      if (dead) {
        v.pause();
        setPlaying(false);
        setStatus && setStatus('The decoder cannot play this video (codec / resolution / frame rate not supported in hardware) — create a preview proxy in the Files step.');
      }
    }, 1500);
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v || disabled) return;
    if (v.paused) {
      v.play()
        .then(() => armStallCheck(v))
        .catch((e) => {
          if (e && e.name === 'AbortError') return; // seek/pause interrupted play – harmless
          setPlaying(false);
          setStatus && setStatus('Cannot play video: ' + (e && e.message ? e.message : e) + ' — create a preview proxy in the Files step.');
        });
      setPlaying(true);
    } else {
      clearTimeout(stallCheckRef.current);
      v.pause();
      setPlaying(false);
    }
  };
  const pause = () => {
    const v = videoRef.current;
    if (v) v.pause();
    setPlaying(false);
  };
  const stepFrame = (n) => {
    if (disabled) return;
    pause();
    seek(time + n / fps);
  };

  // keyboard: space play, arrows frame step (shift = 1 s), M mute
  useEffect(() => {
    const h = (e) => {
      if (isTyping(e)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight') stepFrame(e.shiftKey ? fps : 1);
      else if (e.code === 'ArrowLeft') stepFrame(e.shiftKey ? -fps : -1);
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'm' || e.key === 'M')) setMuted((m) => !m);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return { video, dur, fps, limit, frame: 1 / fps, playing, muted, setMuted, seek, toggle, pause, stepFrame, disabled: !!disabled, time };
}

/** True while the key event comes from something editable (inputs, CodeMirror) — shortcuts stay quiet there. */
export function isTyping(e) {
  const t = e.target;
  return !!(t && (t.isContentEditable || (t.closest && t.closest('input, textarea, select, [contenteditable], .cm-editor'))));
}
