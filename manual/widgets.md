# Creating widgets

A widget is a small piece of code that draws one thing over the video: a number, a gauge, a graph, a map, a horizon.
The app only feeds it data from the blackbox; what it looks like is entirely up to the code.

![Widget editor](../images/Screenshot_2.png)

## What a widget is made of

- **JavaScript**: one function that receives the widget's settings and the current telemetry values and returns HTML.
- **SVG**: any shape, arc, path or chart can be drawn inline in the returned HTML.
- **Settings**: a short list the code declares (colours, units, sizes, modes); the app turns it into a form, so
  everyday changes need no code editing.
- **Icon and tags**: a small single-colour icon and a few categories (`gauge`, `speed`, `map`, ...) so the widget is
  easy to find in the **Add widget** dialog.

Anything a browser can draw, a widget can draw. There is no fixed list of widget types.

## Where to start

1. In the **Widgets** step click **Add widget**. The dialog shows the built-in **Examples** and **My library** as a
   grid of cards; type in the search box (a name, a column, or `#tag`) or click the tag chips to filter. Click a card
   to put a copy on the video.
2. The **Selected widget** card shows the widget's **Settings** form: colours (click the swatch for a picker with
   transparency), units, sizes, modes, sorted into groups with an icon (click a group to open it; a group with
   changed values says so in its header). **Search settings** finds a setting by name or description across all
   groups. Changed values are highlighted; the undo arrow returns one to its default, **Reset all to defaults** all of them.
3. Set **Columns** to the blackbox columns the widget reads; the code receives them as `ctx.values[0]`, `ctx.values[1]`, ...
   The **?** mark opens the INAV field reference, which doubles as a column picker.
4. Drag and resize the widget on the video (switch **Edit** on above the video; **Snap** and **Grid** help with
   alignment). Its size is available to the code, so draw relative to it.
5. **Edit code** (or a double-click on the widget) opens the editor: the **Code** tab is the function, the
   **Settings definition** tab is the list the form is generated from (name, type, default, description, group
   icons), **Icon & tags** holds the icon SVG and the categories, the **API reference** tab lists everything the code
   receives (settings, interpolated values, history, statistics, state, images). **Save to library** keeps your
   version in **My library**; from the **Add widget** dialog it can be edited, exported or deleted (menu on the card),
   and the header buttons import / export the whole library as JSON.
6. **Layouts** stores the whole arrangement (all widgets with positions, sizes, code and settings) under a name and
   loads it again later, rescaled to the current video size.

The definition is a JSON array. Types: `text`, `int`, `number`, `color_picker`, `bool` and `select` (with `values`);
a `group` entry makes a collapsible section of the form with its own icon:

```json
[
  { "group": { "name": "Sticks", "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"7\" cy=\"12\" r=\"4\"/><circle cx=\"17\" cy=\"12\" r=\"4\"/></svg>", "items": [
    { "name": "Mode", "type": "select", "values": { "1": "Mode 1", "2": "Mode 2" }, "default": 2 },
    { "name": "Min", "type": "int", "default": -500, "description": "stick range (INAV rcCommand is -500..500)" }
  ] } },
  { "group": { "name": "Labels", "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><path d=\"M3 12V4h8l10 10-8 8z\"/></svg>", "items": [
    { "name": "Labels", "type": "bool", "default": true },
    { "name": "Label font", "type": "text", "default": "Arial" }
  ] } }
]
```

The code reads a setting by its name in snake_case: `var MODE = settings.mode.value;`, `var FONT = settings.label_font.value;`.

## The easy way: let AI write it

Writing widget code by hand is not necessary. The repository contains a skill for [Claude Code](https://claude.com/claude-code) in `.claude/skills/widget/`
that holds the complete widget contract, design rules, icon rules, a template and a test runner.

1. Open the repository folder in Claude Code.
2. Type `/widget` followed by what you want, for example: `/widget battery voltage with a bar that turns red under 3.5 V per cell`.
3. The result is an import file: in the **Widgets** step open **Add widget** and use the import button in the dialog's
   header. The widget lands in **My library**, with its icon, tags and settings, ready to be added to the video.

The skill also modifies existing widgets: paste your code and describe the change. Ready-made widgets from the
repository's `widgets/` folder are imported the same way.
