import React, { useEffect, useState } from 'react';
import { fmtTime, parseTime } from '../time.js';

/** Text field for a timecode ("m:ss.mmm" or seconds); commits on Enter / blur, Escape reverts. */
export default function TimeInput({ value, onCommit, disabled, title, width = 84 }) {
  const [text, setText] = useState(fmtTime(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(fmtTime(value));
  }, [value, editing]);
  const commit = () => {
    const t = parseTime(text);
    if (Number.isFinite(t)) onCommit(t);
    setEditing(false);
  };
  return (
    <input
      className="input mono"
      style={{ width, padding: '2px 6px', color: 'var(--accent)' }}
      value={text}
      disabled={disabled}
      title={title}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          setText(fmtTime(value));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
