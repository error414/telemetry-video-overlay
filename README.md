# Blackbox overlay for INAV

Desktop app that draws telemetry widgets from INAV blackbox logs over your FPV video.
Widgets are small HTML/JS snippets you write yourself (read-only examples are included).

The app does one thing only: add widgets to a video and export the result.
No editing, trimming or effects.

## Workflow

The app guides you through four steps (the stepper at the top; you can go back and forth at any time):

1. **Start** – continue the previous session, start a new project or open a project file.
2. **Files** – open the video (any common format; a preview proxy can be made when playback struggles) and the blackbox log (raw `.txt` / `.bbl`, decoded with `blackbox_decode`; several logs can be combined). The next steps open once both are loaded.
3. **Sync** – set offset and drift by hand, or automatically from the camera motion in the footage or a Gyroflow project.
4. **Widgets** – **Add widget** opens a searchable grid of examples and your library; adjust the settings in the form, place the widget on the video, edit its code, save layouts.
5. **Export** – choose the range and burn the overlay into a video with ffmpeg, or write a PNG frame sequence.

Manuals: [Creating widgets](manual/widgets.md) · [Synchronising video and blackbox](manual/synchronisation.md)

## Disclaimer

This application was vibe-coded: the whole codebase was written by AI (Claude Code) from prompts.
Expect rough edges, use at your own risk.

## Screenshot

The **Widgets** step: a motor RPM gauge placed over DJI footage with the goggles OSD, the timeline with the throttle trace and two named markers under the video, the widget's settings on the right.

![Blackbox overlay for INAV — Widgets step](images/Screenshot_1.png)

## License

GNU General Public License v3.0 – see [LICENSE](LICENSE).
