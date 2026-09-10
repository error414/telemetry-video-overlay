import React, { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';

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
      if (e.key === 'Enter') (e.preventDefault(), onAnswer(true));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onAnswer]);

  return (
    <Dialog
      title={title}
      icon="help"
      width={440}
      zIndex={130}
      onClose={() => onAnswer(false)}
      actions={
        <>
          <button className="btn btn-text" onClick={() => onAnswer(false)}>
            No
          </button>
          <button ref={yesRef} className="btn btn-filled" onClick={() => onAnswer(true)}>
            Yes
          </button>
        </>
      }
    >
      <div className="break-words">{message}</div>
    </Dialog>
  );
}
