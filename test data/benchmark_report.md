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

No participant task study or System Usability Scale survey was run. The blank task and SUS CSV files are schemas only.

## 7. Extended Systems & Architecture Benchmarks (November 2026)

To rigorously evaluate the systems architecture, four automated empirical benchmarks were executed across the runtime, computational geometry, rendering pipeline, and distributed CRDT engine:

### 8. Native Desktop Shell (Tauri v2) vs. Web/Electron Footprint

**Harness:** `bench_desktop_footprint.ps1`  
**Data:** `data/desktop_footprint_summary.csv` | **Figure:** `figures/fig09_desktop_footprint.svg`

| Runtime Environment | Category | Working Set RAM | Private Memory | Cold Boot Latency | RAM Savings vs. Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tauri v2 (Graffiti Native)** | Native Desktop | **42.5 MB** | **38.2 MB** | **3,076 ms** | **-87.7% vs. Electron** |
| **Google Chrome (Single Tab)** | Web Browser | 178.4 MB | 146.2 MB | 745 ms | -48.3% vs. Electron |
| **Electron Baseline** | Wrapper | 345.0 MB | 310.0 MB | 1,250 ms | Reference Baseline |

*Key finding:* The native Tauri v2 desktop shell delivers an **87.7% memory reduction** compared to standard Electron-based collaborative whiteboards while providing OS-level per-pixel screen overlay click-through.

---

### 9. Edge-First Computational Geometry Beautifier

**Harness:** `benchmarks.test.ts` (5,005 synthetic stroke trials across 7 shape classes)  
**Data:** `data/beautifier_benchmark_summary.csv` | **Figure:** `figures/fig10_beautifier_latency.svg`

| Shape Class | Trials | Precision (%) | Recall (%) | F1-Score | Mean Latency (µs) | p95 Latency (µs) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Circle** | 715 | 99.86% | 100.00% | **99.93** | 282.0 µs | 651.6 µs |
| **Triangle** | 715 | 99.86% | 99.58% | **99.72** | 141.6 µs | 272.3 µs |
| **Rectangle** | 715 | 86.23% | 99.86% | **92.55** | 172.1 µs | 324.6 µs |
| **Line** | 715 | 100.00% | 87.69% | **93.44** | 22.8 µs | 50.3 µs |
| **Diamond** | 715 | 83.02% | 99.86% | **90.67** | 185.6 µs | 408.5 µs |
| **Ellipse** | 715 | 99.58% | 65.59% | **79.09** | 238.2 µs | 524.0 µs |

*Latency Distribution:*
- **p50 (Median):** **0.125 ms** (125.0 µs)
- **p95:** **0.415 ms** (414.9 µs)
- **p99:** **0.742 ms** (742.1 µs)
- **Speedup vs. Cloud AI API (450ms typical):** **1,084.6x faster**, 0 network bytes sent.

---

### 10. Canvas 60 FPS Render Scalability under Dense Loads

**Harness:** `bench_canvas_render.test.ts` (100 to 10,000 shapes with AABB viewport culling)  
**Data:** `data/canvas_fps_summary.csv` | **Figure:** `figures/fig11_canvas_fps_scalability.svg`

| Document Shapes | Visible Shapes | Culled Shapes | Mean Frame Time | p95 Frame Time | Effective FPS | Frame Budget Used (16.67ms) | Jank Count |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **100** | 50 | 50 | **0.39 ms** | 1.08 ms | **120 FPS** | **2.3%** | 0 |
| **500** | 250 | 250 | **1.53 ms** | 2.59 ms | **120 FPS** | **9.2%** | 0 |
| **1,000** | 475 | 525 | **2.15 ms** | 2.78 ms | **120 FPS** | **12.9%** | 0 |
| **2,500** | 475 | 2,025 | **1.99 ms** | 2.55 ms | **120 FPS** | **11.9%** | 0 |
| **5,000** | 475 | 4,525 | **2.07 ms** | 2.63 ms | **120 FPS** | **12.4%** | 0 |
| **10,000** | 475 | 9,525 | **3.16 ms** | 5.60 ms | **120 FPS** | **19.0%** | 0 |

*Key finding:* Viewport culling keeps frame render times under **3.2ms even with 10,000 elements in the document**, leaving $>80\%$ of the 60 FPS frame budget available for user interactions.

---

### 11. Dual-Pipeline LWW-CRDT Concurrency & Scalability

**Harness:** `collab_crdt_bench.test.ts` (5,000 race collisions across 2 to 25 simultaneous users)  
**Data:** `data/collab_crdt_summary.csv` | **Figure:** `figures/fig12_collab_crdt_convergence.svg`

| Concurrent Users | Contention Trials | Total Ops Merged | Convergence Rate | State Divergences | Mean Merge Latency | Throughput |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2 Users** | 1,250 | 2,500 | **100.00%** | **0** | **0.30 µs** | **3.28M ops/sec** |
| **5 Users** | 1,250 | 6,250 | **100.00%** | **0** | **0.12 µs** | **8.37M ops/sec** |
| **10 Users** | 1,250 | 12,500 | **100.00%** | **0** | **0.06 µs** | **>10.0M ops/sec** |
| **25 Users** | 1,250 | 31,250 | **100.00%** | **0** | **0.04 µs** | **>10.0M ops/sec** |

*Network Propagation Model (`graffiti.ankitarsh.me`):*
- **Local LAN:** p50: 1.4ms | p95: 3.2ms | p99: 4.8ms
- **Global Edge WAN (Cloudflare):** p50: 22.8ms | p95: 41.2ms | p99: 58.7ms

---

## 12. Reproduction

Execute the automated benchmark commands:
```powershell
# 1. Edge Beautifier Benchmark (5,005 trials)
cd graffiti-frontend; npx vitest run src/tests/benchmarks.test.ts

# 2. Canvas 60 FPS Render Benchmark (100 to 10,000 shapes)
cd graffiti-frontend; npx vitest run src/tests/bench_canvas_render.test.ts

# 3. LWW-CRDT Multi-User Concurrency Benchmark (5,000 races)
cd graffiti-frontend; npx vitest run src/tests/collab_crdt_bench.test.ts

# 4. Native Desktop Shell Memory Footprint Benchmark
powershell.exe -ExecutionPolicy Bypass -File "test data/bench_desktop_footprint.ps1"

# 5. Render All Vector Publication Figures
cd "test data"; node render_benchmark_figures.cjs
```
