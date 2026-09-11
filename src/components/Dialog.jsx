import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/**
 * Modal frame (scrim + rounded panel). `onClose` runs on Escape and on a click on the scrim;
 * leave it out for dialogs that must be answered. `size`: 'md' (default), 'wide', 'full'.
 */
export default function Dialog({ title, icon, onClose, size = 'md', width, children, actions, className = '', bodyClassName = '', zIndex = 50, closeOnBackdrop = true }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const sizeClass = size === 'wide' ? ' dialog-wide' : size === 'full' ? ' dialog-full' : '';
  return createPortal(
    <div className="scrim" style={{ zIndex }} onMouseDown={(e) => e.target === e.currentTarget && closeOnBackdrop && onClose && onClose()}>
      <div role="dialog" aria-modal="true" className={'dialog' + sizeClass + ' ' + className} style={width ? { width: `min(92vw, ${width}px)` } : undefined}>
        {title && (
          <div className="dialog-title">
            {icon && <Icon name={icon} />}
            <span className="flex-1 min-w-0">{title}</span>
            {onClose && (
              <button className="btn btn-icon" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
          </div>
        )}
        <div className={'dialog-body ' + bodyClassName}>{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
