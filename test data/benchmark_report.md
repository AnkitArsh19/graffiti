# Graffiti comparative benchmark report

**Run date:** 6 November 2026
**Graffiti source snapshot:** `6bd6c4705bb8ec596941e60df680d783be38685c`
**Purpose:** Preserve the procedure and observations behind the CSV data and PNG graphs in this folder.

## 1. Environment and source

Graffiti was served from a Vite production preview at `http://127.0.0.1:4173/`. The captured run metadata records Chrome `156.0.8078.81`, Node.js `v24.14.0`, Windows `10.0.26300`, a 12th Gen Intel Core i7-1255U, 12 logical cores, 16.87 GB reported memory, a 1440 × 900 CSS-pixel viewport, and device scale factor 1. Each measured run used a fresh browser context unless the method says otherwise. Graffiti used local browser storage; no account was used. Whitebophir trials created a private board.

The identified Graffiti commit is an earlier repository snapshot. The project `main` branch advanced after it. The measurements below must not be attributed to a later commit without rerunning the scripts. The four comparators were public hosted applications; their deployed versions and remote network/server conditions were not pinned. All comparative results are therefore limited to the recorded session and tested action.

## 2. Immediate reload recovery comparison

### Procedure

The Playwright script ran ten trials per system in a fresh browser context. In each trial it opened a new board, created one rectangle through the visible interface, waited 1.5 seconds, reloaded the same context, and checked the application's object count. UI actions differed where required by each tool (the row-level `method` field records them). A trial counted as recovered when one object was present after reload.

This is a narrow short-term browser recovery check. It does not test long-term retention, sign-in, remote synchronization, cross-device recovery, simultaneous editing, or completion of a multi-page note task.

### Observations

| System | Recovered | Trials | Observed rate | 95% Wilson interval |
|---|---:|---:|---:|---:|
| Graffiti | 10 | 10 | 100% | 72.25–100% |
| Excalidraw | 10 | 10 | 100% | 72.25–100% |
| draw.io | 10 | 10 | 100% | 72.25–100% |
| tldraw | 10 | 10 | 100% | 72.25–100% |
| Whitebophir | 10 | 10 | 100% | 72.25–100% |

The observed result is a tie. With ten trials per tool, the intervals are wide; this does not establish statistical equivalence or broad reliability.

## 3. Graffiti board-readiness proxy

### Procedure

A deterministic local-storage fixture contained 0, 100, 500, or 1,000 labeled rectangles. Ten fresh browser contexts were run at each object count, with counts rotated across runs. The timer started at the navigation response end. It stopped when the element-count UI and canvas were present and two animation frames had elapsed. All 40 pages reached this condition without a recorded page exception.

This is a response-end-to-board-ready proxy. It is not pointer-input-to-render latency, does not isolate a single rendering component, and is not comparable with timings from remotely hosted products.

### Observations

| Objects | Trials | Median (ms) | Q1–Q3 (ms) | 95th percentile (ms) |
|---:|---:|---:|---:|---:|
| 0 | 10 | 258.70 | 226.88–288.20 | 576.39 |
| 100 | 10 | 271.10 | 251.22–275.00 | 293.83 |
| 500 | 10 | 279.05 | 270.55–309.25 | 358.44 |
| 1,000 | 10 | 333.95 | 312.55–342.95 | 356.38 |

The zero-object group includes a recorded 789.2 ms outlier. These values characterize this run and fixture; they are not a service-level guarantee.

## 4. Persistence and export checks

### Immediate persistence

`data/graffiti_persistence_checks.csv` records 10/10 successful save-and-reload checks on the tested Graffiti snapshot. This is the Graffiti portion of the same narrow browser recovery check, not an additional independent benchmark.

### Export object counts

For one-page fixtures with 100, 500, and 1,000 labeled rectangles, the recorded SVG and `.graffiti` JSON outputs contained the expected rectangle and label/object counts. The PNG checks verified that the downloads were nonempty PNG files with valid signatures and recorded their dimensions and SHA-256 hashes. They did not compare rendered pixels against a reference or verify that every object was visible in the raster.

The smaller fixtures under `data/export_scope/` test scope explicitly:

- `visible.*`: one visible rectangle on the active page.
- `offscreen.*`: that rectangle plus one rectangle outside the visible viewport.
- `two_pages.*`: one rectangle on each of two pages, with page one active.

For `offscreen`, PNG output was byte-for-byte identical to `visible.png`; SVG and `.graffiti` JSON contained both rectangles. For `two_pages`, JSON contained both pages and both rectangles, while PNG and SVG represented only the active page. These files record the tested export behavior; the PNG result is evidence about captured viewport scope, not a claim about export quality.

## 5. Graphs and raw files

The PNG graphs `figures/fig06_reload_recovery_measured.png`, `figures/fig07_graffiti_board_ready_measured.png`, and `figures/fig08_graffiti_export_scope_measured.png` are generated from the measured CSVs. `render_results.py` also writes SVG and PDF versions and recomputes the summary CSVs. Raw trial rows are retained so the summaries can be independently recalculated.

The browser probe screenshots document visible state around selected checks. They do not replace the trial CSVs and should not be interpreted as separate observations.

## 6. Not measured

No participant task study or System Usability Scale survey was run. The blank task and SUS CSV files are schemas only. No claim is made about participant task time, usability, preference, collaboration quality, long-term durability, cross-device behavior, or overall product superiority. The current report also does not establish how the latest repository `main` performs.

## 7. Reproduction

The root `README.md` gives exact setup and commands. `measure_graffiti.cjs`, `measure_reload_comparison.cjs`, and `measure_export_scope.cjs` are the measurement scripts. `render_results.py` derives the graph and summary artifacts. The Graffiti snapshot, environment metadata, trial-level observations, export fixtures, and comparator screenshots are kept with this report so each reported value has a corresponding source file.
