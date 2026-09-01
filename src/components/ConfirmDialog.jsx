import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Yes/no confirmation modal.
 * useConfirm() returns [confirm, dialog]: `await confirm('Delete X?')` resolves true/false,
 * `dialog` must be rendered once (anywhere) so the modal can show up.
 */
export function useConfirm() {
  const [req, setReq] = useState(null); // { message, title, resolve }
  const confirm = useCallback(
    (message, { title = 'Are you sure?' } = {}) =>
      new Promise((resolve) => {
        setReq((cur) => {
          if (cur) cur.resolve(false); // a second question replaces the first
          return { message, title, resolve };
        });
      }),
    []
  );
  const answer = useCallback((ok) => {
    setReq((cur) => {
      if (cur) cur.resolve(ok);
      return null;
    });
  }, []);
  const dialog = req ? <ConfirmDialog title={req.title} message={req.message} onAnswer={answer} /> : null;
  return [confirm, dialog];
}

function ConfirmDialog({ title, message, onAnswer }) {
  const yesRef = useRef(null);
  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') (e.preventDefault(), onAnswer(false));
      else if (e.key === 'Enter') (e.preventDefault(), onAnswer(true));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onAnswer]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}>
      <div
        role="dialog"
        aria-modal="true"
        className="rounded-lg p-5 flex flex-col gap-4"
        style={{ width: 'min(92vw, 440px)', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}
      >
        <div className="font-semibold text-base">{title}</div>
        <div className="text-sm break-words" style={{ color: 'var(--muted)' }}>
          {message}
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={() => onAnswer(false)}>
            No
          </button>
          <button ref={yesRef} className="btn btn-danger" onClick={() => onAnswer(true)}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
