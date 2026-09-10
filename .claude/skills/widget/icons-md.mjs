#!/usr/bin/env node
// Regenerates icons.md (the icon reference of this skill) from src/icons.js so the SVG strings a
// widget definition embeds are exactly the ones the app ships. Run after changing icons.js:
//   node .claude/skills/widget/icons-md.mjs
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..', '..', '..');
const { GROUP_ICONS, WIDGET_ICONS, groupIconKey } = await import(pathToFileURL(path.join(root, 'src', 'icons.js')).href);

const NAMES = ['Data', 'Value', 'Range', 'Limits', 'Text', 'Labels', 'Box', 'Border', 'Position', 'Axis', 'Scale', 'Bank scale', 'Line', 'Curve', 'Trail', 'Profile', 'Track', 'Marker', 'Needle', 'Arrows', 'Look', 'Colors', 'Bar', 'Bars', 'Dial', 'Sticks', 'Map', 'Aircraft', 'View', 'Ball', 'Ladder', 'Heading', 'Angles', 'Peak hold', 'Idle', 'Animation'];
const byKey = {};
for (const n of NAMES) (byKey[groupIconKey(n)] ||= []).push(n);

let md = `# Icons — reference for widget and settings-group icons

Generated from \`src/icons.js\` by \`icons-md.mjs\` (do not edit by hand; run the script after changing
\`icons.js\`). Every icon is a **single-colour line drawing on a 24×24 grid**: \`viewBox="0 0 24 24"\`,
\`fill="none"\`, \`stroke="currentColor"\`, \`stroke-width="1.8"\`, round caps and joins, solid parts as
\`fill="currentColor" stroke="none"\`. No \`width\`/\`height\`, no \`xmlns\`, no colours, no \`<style>\`,
no scripts, no \`href\`/\`url()\` — the app rejects anything else and shows a generic icon instead.

## Settings-group icons (\`"icon"\` inside \`{ "group": { … } }\`)

Pick the row whose *group names* match the group you are defining and paste the SVG string as the
group's \`icon\` (in a JSON file the double quotes are escaped: \`\\"\`). A group name that fits none
of the rows gets a **new** icon drawn in the same style — never leave a group without one.

| key | typical group names | SVG |
|---|---|---|
`;
for (const [key, svg] of Object.entries(GROUP_ICONS)) md += `| \`${key}\` | ${(byKey[key] || []).join(', ') || '—'} | \`${svg}\` |\n`;

md += `
## Widget icons (\`"icon"\` of the widget record)

One icon per widget, showing *what it draws* (a dial, a tape, a graph, a map pin…), in the same
style as above. The built-in ones, for reuse and as the reference for the level of detail:

| key | widget | SVG |
|---|---|---|
`;
for (const [key, svg] of Object.entries(WIDGET_ICONS)) md += `| \`${key}\` | ${key.replace(/_/g, ' ')} | \`${svg}\` |\n`;

md += `
## Drawing a new one

- Sketch on a 24×24 grid with 2–3 px margins; 1.8 px strokes; at most ~6 path commands — the icon
  is shown at 18–26 px, detail is lost.
- Prefer the outline of the widget's *shape*: a 270° arc for a dial, a rectangle with ticks for a
  tape, a polyline for a graph, a circle with a horizon line for an attitude indicator.
- One solid element at most (a dot, a marker) as \`fill="currentColor" stroke="none"\`.
- Check it against a dark and a light background in a plain HTML page before shipping.
`;
writeFileSync(path.join(here, 'icons.md'), md.replace(/\r?\n/g, '\r\n'));
console.log('icons.md written:', Object.keys(GROUP_ICONS).length, 'group icons,', Object.keys(WIDGET_ICONS).length, 'widget icons');
