# Creating widgets

A widget is a small piece of code that draws one thing over the video: a number, a gauge, a graph, a map, a horizon.
The app only feeds it data from the blackbox; what it looks like is entirely up to the code.

![Widget editor](../images/Screenshot_2.png)

## What a widget is made of

- **JavaScript**: one function that receives the widget's settings and the current telemetry values and returns HTML.
- **SVG**: any shape, arc, path or chart can be drawn inline in the returned HTML.
- **Settings**: a short list the code declares (colours, units, sizes, modes); the app turns it into a form, so
  everyday changes need no code editing.

Anything a browser can draw, a widget can draw. There is no fixed list of widget types.

## Where to start

1. Open the **Library** tab and unfold **Examples**. Click **Add** next to one to put it on the video.
2. In the **Widgets** tab, the **Selected widget** section shows the widget's **Settings** form: colours (click the swatch
   for a picker with transparency), units, sizes, modes, sorted into collapsible groups (click a group name to
   open it; a group with changed values says so in its header). Changed values are highlighted; **↺** returns one
   to its default, **Reset to defaults** all of them.
3. Set **Columns** to the blackbox columns the widget reads; the code receives them as `ctx.values[0]`, `ctx.values[1]`, ...
4. Drag and resize the widget on the video. Its size is available to the code, so draw relative to it.
5. **Edit code** opens the editor: the **Code** tab is the function, the **Settings definition** tab is the list the
   form is generated from (name, type, default, description), the **API reference** tab lists everything the code
   receives (settings, interpolated values, history, statistics, state, images). **Save to library** keeps your version.

The definition is a JSON array. Types: `text`, `int`, `number`, `color_picker`, `bool` and `select` (with `values`);
a `group` entry makes a collapsible section of the form:

```json
[
  { "group": { "name": "Sticks", "items": [
    { "name": "Mode", "type": "select", "values": { "1": "Mode 1", "2": "Mode 2" }, "default": 2 },
    { "name": "Min", "type": "int", "default": -500, "description": "stick range (INAV rcCommand is -500..500)" }
  ] } },
  { "group": { "name": "Labels", "items": [
    { "name": "Labels", "type": "bool", "default": true },
    { "name": "Label font", "type": "text", "default": "Arial" }
  ] } },
  { "name": "Background", "type": "color_picker", "default": "rgba(255,255,255,.7)" }
]
```

The code reads a setting by its name in snake_case: `var MODE = settings.mode.value;`, `var FONT = settings.label_font.value;`.

## The easy way: let AI write it

Writing widget code by hand is not necessary. The repository contains a skill for [Claude Code](https://claude.com/claude-code) in `.claude/skills/widget/`
that holds the complete widget contract, design rules, a template and a test runner.

1. Open the repository folder in Claude Code.
2. Type `/widget` followed by what you want, for example: `/widget battery voltage with a bar that turns red under 3.5 V per cell`.
3. Paste the code into a new widget (**+ New widget** in the Widgets tab, then **Edit code**), paste the settings
   definition into the **Settings definition** tab, and set its columns.

The skill also modifies existing widgets: paste your code and describe the change.
