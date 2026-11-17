# Tempo Favicon Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this small asset change inline.

**Goal:** Integrate the approved anthracite Tempo icon for browsers and iPhone.

**Architecture:** Preserve one selected raster master and export standard opaque
PNG sizes plus a multi-size ICO. Keep existing PWA/push paths; add explicit
browser favicon links and offline-shell entries.

**Tech Stack:** PowerShell / System.Drawing for mechanical export, existing Vite app.

**Spec:** ../specs/2026-11-17-tempo-favicon-design.md

## Global Constraints

- Keep Live above Scores, white italic type, red dot and anthracite background.
- Preserve full words at all sizes; report the 16 px readability limitation.
- Do not change unrelated working changes or cache live data.
- The user's go authorizes local implementation; do not publish.

## Review Focus

- PNG dimensions and opaque background, including the 180 px Apple icon.
- ICO directory entries and actual embedded 16/32/48 px payloads.
- Relative URLs must resolve under the GitHub Pages subdirectory.
- Existing manifest and push icon URLs must still resolve.
- Added favicons must be in the shell cache without broadening API caching.

### Task 1: Export and integrate selected artwork

- [x] Copy the approved master into docs/branding and add scripts/export-icons.ps1.
- [x] Export 16/32/48 px PNGs, 180/192/512 px icons and a multi-size favicon.ico.
- [x] Link the browser favicons and add their paths to Vite's offline shell.
- [x] Render a size comparison, inspect it, and check file headers and references.
- [x] Run npm test, npm run build and dotnet build backend/App.Api.
- [x] Review the scoped changes; leave unrelated edits untouched and report local status.

No new unit tests are needed for this reversible image/configuration change;
file-format checks, visual inspection and the existing full suite cover it.
Baseline: 10 runtime tests and 445 Vitest tests passed before changes.
## Verification results

- npm test: 10 runtime tests and 445 Vitest tests passed.
- npm run build: passed; existing classic config.js script warning remains.
- dotnet build backend/App.Api: passed, 0 warnings and 0 errors.
- PNG dimensions/opaque RGB, ICO frames/offsets and source SHA verified.
- Production package: 6 relative link targets, 12 shell assets and 7 identical
  exported icons verified; API/config exclusions retained.
- Independent read-only review: no actionable findings. Reviewer could not use
  git diff in the sandbox; parent inspected the scoped diff successfully.
- Actual-size preview inspected: 16 px full words have limited readability.
- Local integration only. No commit, push or deployment performed; unrelated
  existing edits are preserved.

## Publication follow-up

The user subsequently authorized publication with go on 2026-11-17. Publish
only the approved icon changes on top of origin/main; preserve unrelated local work.

Release verification on the isolated origin/main-based tree: 10 runtime tests
and 434 Vitest tests passed; app and backend builds passed. Six relative link
targets, twelve shell assets, seven exported icons and API/config exclusions verified.
