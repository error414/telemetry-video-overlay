import React from 'react';
import { UI_ICONS, WIDGET_ICONS, safeIconSvg } from '../icons.js';

/** One of the app's own icons (icons.js UI_ICONS) at `size` px, coloured by the surrounding text. */
export default function Icon({ name, size, className = '', style, title }) {
  const body = UI_ICONS[name] || UI_ICONS.dot;
  const s = size ? { width: size, height: size, ...style } : style;
  return (
    <span className={'icon ' + className} style={s} title={title} aria-hidden={title ? undefined : true}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: body }} />
    </span>
  );
}

/** An icon stored as an SVG string (widget icons, settings-group icons); falls back to `fallback` (UI icon name). */
export function SvgIcon({ svg, fallback = 'widgets', size, className = '', style, title }) {
  const safe = safeIconSvg(svg);
  if (!safe) return <Icon name={fallback} size={size} className={className} style={style} title={title} />;
  const s = size ? { width: size, height: size, ...style } : style;
  return <span className={'icon ' + className} style={s} title={title} aria-hidden={title ? undefined : true} dangerouslySetInnerHTML={{ __html: safe }} />;
}

/** Icon of a widget record: its own `icon`, else the generic widget icon. */
export function WidgetIcon({ widget, size, className, style }) {
  return <SvgIcon svg={widget && widget.icon ? widget.icon : WIDGET_ICONS.generic} size={size} className={className} style={style} />;
}
