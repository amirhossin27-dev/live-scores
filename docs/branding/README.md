# Live Scores: approved Tempo icon

Selected design: two lines, Live above Scores, white bold italic type,
red live dot and anthracite background. The selected source artwork is
preserved in live-scores-tempo-master.png. Generated with the built-in
ImageGen tool during the design discussion; exports do not regenerate it.

Run from the app directory on Windows:

    pwsh -File scripts/export-icons.ps1

Exports in public/icons:

- favicon-16.png, favicon-32.png, favicon-48.png
- favicon.ico with the same three PNG frames
- apple-touch-icon.png (180 px)
- icon-192.png and icon-512.png for PWA and push notifications

All exported PNGs are opaque, full-square RGB images. Native platforms apply
their own icon masks. The app's existing theme colors and live-data behavior
are unaffected. The manifest keeps its existing any-purpose icons.

icon-size-preview.png shows actual pixel sizes followed by enlarged pixel
views. The two full words are difficult to read at 16 px; the approved
spelling is retained rather than silently replacing it with initials.

After deployment, an already installed iPhone shortcut may retain the old
icon until it is added to the home screen again. Local changes alone do not
update the published site.

The original generation prompt is recorded in [source-prompt.md](source-prompt.md).
