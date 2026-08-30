import React, { useLayoutEffect, useRef } from 'react';

/**
 * Renders widget HTML inside a shadow root so the app's own stylesheet (.label, .btn, .card …)
 * cannot leak into widgets — the preview then matches export, where no app CSS exists.
 * Inherited properties (color, font-family) still flow in from the host, as in export.
 */
export default function ShadowHtml({ html, style, hostRef, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    if (root.__html !== html) {
      root.innerHTML = html;
      root.__html = html;
    }
  }, [html]);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (hostRef) hostRef.current = el;
      }}
      style={style}
      {...rest}
    />
  );
}
