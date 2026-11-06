# Graffiti test data and benchmark

This folder contains the scripts, raw trial rows, exported files, screenshots, and graphs for the browser measurements recorded on **6 November 2026**.

## Provenance and scope

The Graffiti browser measurements were run against the production preview of repository commit [`6bd6c4705bb8ec596941e60df680d783be38685c`](https://github.com/AnkitArsh19/graffiti/commit/6bd6c4705bb8ec596941e60df680d783be38685c). The repository's `main` branch has advanced since that snapshot. These results therefore describe that commit only; they are not measurements of the current `main` head.

The comparator tests used the public hosted versions of Excalidraw, draw.io, tldraw, and Whitebophir available during the recorded session. Their deployed versions and remote network conditions were not pinned. Repeat runs can differ as those services change.

No participant study was conducted. `data/task_trials_blank.csv` and `data/sus_responses_blank.csv` are empty collection templates; they contain no participant outcomes. Do not treat empty rows or the proposed study protocol as results.

## What is included

- `benchmark_report.md` — methods, measured results, scope, and limitations.
- `measure_*.cjs` — Playwright scripts for the reload, readiness, persistence, and export checks.
- `data/*_trials.csv` — trial-level observations; summary CSVs are derived from these rows.
- `data/export_scope/` — the captured `.graffiti`, PNG, and SVG downloads for visible, offscreen, and two-page fixtures.
- `data/*probe*.png` — browser screenshots captured during comparator checks; these are run evidence, not additional trials.
- `figures/fig06*` through `figures/fig08*` — PNG graphs generated from the recorded CSVs.
- `render_results.py` — regenerates the derived summary CSVs and PNG/SVG/PDF graphs in this folder.
- `human_study_protocol.md` and the blank CSV schemas — a proposed protocol and data-entry templates, not completed user research.

## Recorded results at a glance

- Immediate reload recovery: **10/10** trials for each of the five systems. This is a tie in this small test; it does not show superior reliability.
- Graffiti readiness proxy: **10 trials per fixture** at 0, 100, 500, and 1,000 labeled rectangles. Median response-end-to-ready times were 258.70, 271.10, 279.05, and 333.95 ms, respectively.
- Export checks: SVG and `.graffiti` JSON structural counts matched fixtures for 100, 500, and 1,000 objects. PNG checks verified only a valid signature and nonempty file; they did not assess visual fidelity.
- Two-page scope check: `.graffiti` JSON preserved both pages; PNG and SVG captured only the active page. Adding an offscreen object left the PNG hash unchanged while SVG and JSON contained both objects.

Read `benchmark_report.md` before using any number or graph. It defines each measurement and its limits.

## Reproduce the recorded snapshot

Use Node.js, Python 3, Google Chrome, and the exact source snapshot above. From a fresh clone of this repository:

```powershell
git checkout 6bd6c4705bb8ec596941e60df680d783be38685c
cd graffiti-frontend
npm.cmd ci
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

Keep that preview running. In a second terminal, from the repository root:

```powershell
cd "test data"
npm.cmd ci
npm.cmd run measure:graffiti
npm.cmd run measure:reload
npm.cmd run measure:export
python render_results.py
```

The comparator script contacts public services. Run it with network access and record the versions/conditions if a new comparison is intended. New measurement runs overwrite the corresponding CSV/JSON and export fixture files under `data/`; preserve this archived run before regenerating it.

`render_results.py` derives its summaries from the trial CSVs. It requires Python packages `pandas`, `numpy`, and `matplotlib`. Install them in an isolated environment if they are not already available.
