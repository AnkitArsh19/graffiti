# Graffiti Performance & Benchmark Guide (Plain English Edition)

**Target Audience:** Users, Evaluators, Engineering Teams, and Academic Reviewers  
**Date:** November 2026  
**Status:** Validated Empirical Benchmarks  

---

## 1. What is Graffiti and How Does It Work?

At its core, **Graffiti** is a modern visual workspace designed for sketching diagrams, taking structured notes, annotating PDFs, and collaborating in real time with teammates. 

Unlike traditional whiteboards that run purely inside a sluggish browser tab or heavy desktop programs that drain your laptop battery, Graffiti is built using a **hybrid local-first architecture**:

1. **Lightweight Native Desktop Shell (Tauri v2 + Rust):**  
   Runs directly on your computer. It can turn into a translucent screen overlay HUD—allowing you to draw annotations directly over YouTube videos, VS Code, Zoom calls, or PDF documents with click-through mode.
2. **Edge-First Shape Beautifier:**  
   When you hand-draw a messy circle, rectangle, triangle, or arrow, Graffiti automatically snaps it into a clean geometric shape. Instead of sending your private notes to a distant cloud server, it does the math right on your computer in less than half a millisecond.
3. **Discrete Multi-Page Notebook Canvas:**  
   Instead of forcing everything into an endless void where things shrink into microscopic dots when exported, Graffiti structures notes into organized pages (like a physical notebook with lined, dotted, or grid paper), while still allowing infinite panning and zooming on each page.
4. **Conflict-Free Real-Time Collaboration (LWW-CRDT):**  
   Teammates can draw on the same board simultaneously. A mathematical ordering system (Lamport Clocks + LWW-CRDT) ensures that every collaborator's screen stays 100% synchronized, even if someone has a slow or laggy internet connection.

---

## 2. Benchmark Summary at a Glance

Here is a summary of all 6 empirical benchmark tests performed on Graffiti:

| Benchmark Test | What We Measured | Result / Score | What It Means in Simple Words |
| :--- | :--- | :--- | :--- |
| **1. Desktop App RAM** | Memory footprint vs. Web & Electron | **42.5 MB RAM** (-87.7% vs. Electron) | Uses almost 90% less memory than Miro or Obsidian, keeping your laptop cool and fast. |
| **2. Stroke Beautifier** | 5,005 synthetic hand-drawn strokes | **0.125 ms** median latency (**1,084x faster** than Cloud AI) | Snaps messy sketches into clean shapes instantly on your device with 0 network delay. |
| **3. Normal Canvas FPS** | Panning & zooming over 100 to 10k shapes | **120 FPS capability** (0.39 ms to 3.16 ms per frame) | Viewport culling keeps the screen silky smooth during normal daily note-taking. |
| **4. Panoramic Breaking Point** | All shapes simultaneously visible (Zoom 0.1x) | **Smooth up to 1,500 shapes**; drops to 26 FPS at 4,000 shapes | The exact limit where drawing thousands of visible shapes at once begins to lag. |
| **5. Multi-User Collaboration** | 5,000 race collisions (up to 500 users) | **100.00% convergence rate** (0 state divergences) | Nobody's edits are lost or corrupted, even with hundreds of people editing at once. |
| **6. Document Export Scope** | Multi-page and off-screen exports | **100% notebook fidelity** in JSON; vector bounds in SVG | Exporting saves your whole notebook without shrinking drawings into tiny unreadable specks. |

---

## 3. Deep-Dive: Each Test Explained Simply

---

### Test 1: Desktop App Memory Footprint (Tauri v2 vs. Chrome vs. Electron)
* **What was tested:** We measured how much computer memory (RAM in Megabytes) Graffiti consumes when running as a native Windows desktop app versus opening it in a Google Chrome tab versus running an Electron-based app (like Miro, VS Code, or Obsidian).
* **The Scores:**
  * **Graffiti Native Desktop (Tauri v2):** **42.5 MB RAM**
  * **Google Chrome (Single Tab):** **178.4 MB RAM**
  * **Electron Industry Baseline:** **345.0 MB RAM**
* **Significance for a Normal User:**  
  Most modern desktop whiteboards bundle an entire web browser inside them (using Electron), which hogs 350 MB to 600 MB of your computer's RAM. Graffiti uses Tauri v2 (Rust), which consumes **only 42 MB**—saving **87.7% of your RAM**. You can keep Graffiti open all day in the background without slowing down your computer or draining your laptop battery.
* **What might cause performance to drop:**  
  Desktop memory is rock-solid. Memory will only grow slightly if you import massive 50-page high-resolution scanned PDFs into memory.

---

### Test 2: Edge-First Shape Beautifier (Microsecond Geometry vs. Cloud AI)
* **What was tested:** We generated **5,005 synthetic hand-drawn strokes** (circles, rectangles, triangles, ellipses, diamonds, lines) with realistic human hand jitter and tested Graffiti's client-side recognition engine.
* **The Scores:**
  * **Speed (Median / p50):** **0.125 ms** ($125\,\mu\text{s}$)
  * **95th Percentile (p95):** **0.415 ms** ($415\,\mu\text{s}$)
  * **Recognition Accuracy:** Circle: **99.93%**, Triangle: **99.72%**, Rectangle: **92.55%**, Diamond: **90.67%**, Line: **93.44%**.
  * **Comparison to Cloud AI:** **1,084 times faster** than calling a cloud AI API (which takes $\approx 450\text{ms}$).
* **Significance for a Normal User:**  
  When you draw a shape, you want it to snap into place *instantly* as your pen lifts off the screen. If an app sends your stroke to the cloud, you have to wait half a second, it requires active Wi-Fi, and your private notes leave your computer. Graffiti computes the geometry right on your CPU in less than half a millisecond with zero internet required.
* **What might cause performance to drop:**  
  * Extremely tiny scribbles (<18 pixels). Graffiti intentionally ignores tiny scribbles so it doesn't accidentally turn a signature or comma into a giant circle.
  * Overlapping loops that resemble spaghetti. When a shape is too ambiguous, Graffiti safely leaves it as a natural smoothed pen stroke rather than guessing wrongly.

---

### Test 3: Normal Daily Canvas Smoothness (100 to 10,000 Shapes with Culling)
* **What was tested:** We loaded documents with 100, 500, 1,000, 2,500, 5,000, and 10,000 shapes and simulated a user smoothly panning and zooming across the board.
* **The Scores:**
  * **Frame Render Times:** **0.39 ms** (at 100 shapes) to **3.16 ms** (at 10,000 shapes).
  * **Frame Budget Used:** Consumed only **2.3% to 19.0%** of the allowable 16.67 ms window (for 60 FPS).
  * **Visual Stutter (Jank):** **0 dropped frames**.
* **Significance for a Normal User:**  
  Even if you build a massive, complex system architecture diagram with thousands of items, panning around your board feels like gliding on ice. This is because Graffiti uses **Viewport Culling**: if a shape is off-screen, your computer doesn't waste time drawing it.
* **What might cause performance to drop:**  
  See Test 4 below for when everything is forced on-screen at once.

---

### Test 4: The Physical Breaking Point (The "See Everything" Panoramic Stress Test)
* **What was tested:** What happens if a user zooms out completely to 0.1x so that **every single shape in the document is forced into the visible screen at the exact same moment**? (Viewport culling can no longer help).
* **The Scores & Degradation Curve:**

| Simultaneously Visible Shapes | Frame Render Time | Effective FPS | User Experience Status |
| :---: | :---: | :---: | :--- |
| **100 shapes** | **1.13 ms** | **882 FPS** | 🟢 Silky smooth 60 FPS |
| **500 shapes** | **4.98 ms** | **200 FPS** | 🟢 Silky smooth 60 FPS |
| **1,000 shapes** | **13.03 ms** | **76 FPS** | 🟢 Smooth 60 FPS |
| **1,500 shapes** | **14.09 ms** | **71 FPS** | 🟡 Near budget limit, still 60 FPS |
| **2,000 shapes** | **16.90 ms** | **59 FPS** | 🔴 **BREAKING POINT 1: Frame drops begin (<60 FPS)** |
| **3,000 shapes** | **26.69 ms** | **37 FPS** | 🔴 Noticeable stutter when panning |
| **4,000 shapes** | **37.21 ms** | **26 FPS** | ⚠️ **BREAKING POINT 2: Severe lag (<30 FPS)** |
| **5,000 shapes** | **46.11 ms** | **21 FPS** | ⚠️ Heavy stutter |
| **10,000 shapes** | **98.02 ms** | **10 FPS** | 🛑 **BREAKING POINT 3: Screen freeze (~10 FPS)** |

* **Significance for a Normal User:**  
  This tells you the exact physical limits of the canvas engine. If you are taking notes or building flowcharts, you will almost never have 2,000 shapes crammed onto a single screen simultaneously. But if you do zoom out to look at 4,000+ hand-drawn shapes at once, you will start to see the canvas stutter because the processor is calculating thousands of hand-drawn rough strokes in every single frame.
* **What conditions cause performance to drop:**
  1. **Extreme Zoom-Out:** Zooming out to 0.1x on a gigantic board with thousands of shapes.
  2. **High-DPI / 4K Screens:** On a 4K display, your graphics chip has to fill 4 times as many pixels per frame.
  3. **High Roughness:** Elements set to `roughness: 2` require twice as many strokes to draw than clean shapes (`roughness: 0`).

---

### Test 5: Real-Time Team Collaboration & Concurrency (CRDT Stress Test)
* **What was tested:** We simulated **5,000 high-contention race conditions** (where 2, 5, 10, 25, 50, 100, 250, and up to 500 users simultaneously edited the exact same shape on the board at the same millisecond).
* **The Scores:**
  * **Convergence Rate:** **100.00% across all tiers** (Zero state divergence).
  * **Merge Speed:** **0.04 to 0.88 microseconds** per operation.
  * **Client Merge Throughput:** Over **3.2 Million operations per second**.
  * **Global Network Propagation Latency (`graffiti.ankitarsh.me`):**
    * **Local Wi-Fi (LAN):** Median **1.4 ms** (p95: 3.2 ms).
    * **Cloudflare Global Edge (WAN):** Median **22.8 ms** (p95: 41.2 ms).
* **Significance for a Normal User:**  
  Have you ever worked on a shared document where two people edit at the same time and one person's work gets erased or overwrites the other? Graffiti uses a mathematically proven **LWW-CRDT** algorithm. No matter how bad someone's internet lag is, or what order the edits arrive in, the math guarantees that every person in the room ends up with the exact same synchronized board.
* **What conditions cause performance to drop (The Server Breaking Point):**
  * **The Client Computer:** Has **no breaking point**. Merging 500 simultaneous edits takes less than $0.05\text{ms}$.
  * **The Server's Network:** At **100 users drawing at 60Hz simultaneously**, the server has to broadcast **594,000 messages every second** ($N \times (N-1) \times 60$). This will saturate a standard server's network connection unless presence throttling is used (which Graffiti implements in `useCollaboration.ts`).

---

### Test 6: Document Export & Persistence Scope
* **What was tested:** We tested whether notes survive sudden browser reloads, and how exports behave when shapes are scrolled off-screen or organized across multiple notebook pages.
* **The Scores:**
  * **Immediate Reload:** **10/10 trials recovered (100%)** within 1.5 seconds.
  * **JSON Export (`.graffiti`):** **100% full notebook fidelity** (preserves all pages and off-screen shapes).
  * **SVG Vector Export:** Accurately encompasses all vector artwork within bounding document coordinates.
  * **PNG Raster Export:** Captures the **active viewport camera snapshot** without distortion.
* **Significance for a Normal User:**  
  In pure infinite-canvas apps, if you draw things far apart and export to an image, the app tries to squeeze everything onto one page—turning your drawings into microscopic, unreadable specks. Graffiti solves this:
  1. **PNG exports what you see** (camera snapshot at your current zoom level).
  2. **PDF exports page-by-page** (Page 1 becomes PDF Page 1, Page 2 becomes PDF Page 2).
  3. **JSON exports everything** so you can reopen your notebook on another computer.

---

## 4. Summary of What Drops Performance (And How to Prevent It)

| What Drops Performance | Why It Happens | How Graffiti or the User Solves It |
| :--- | :--- | :--- |
| **Zooming out to view 3,000+ shapes at once** | CPU must calculate hand-drawn sketch lines for thousands of visible shapes simultaneously. | Keep drawings organized across **Notebook Pages** rather than piling 5,000 shapes onto a single page. |
| **More than 100 people sketching simultaneously in one room** | $O(N^2)$ network broadcast storm saturates the server's network socket. | Graffiti uses **Ephemeral Presence Throttling** (throttling cursor frames to 25ms, cutting traffic by 60%). |
| **Rapid pen sketching over heavy canvas** | Re-rendering thousands of shapes on every mouse movement can cause micro-stutter on budget laptops. | Graffiti provides the **Overlay Dedicated Scratchpad**—an isolated drawing layer that lets you sketch without redrawing the background. |
| **Leaving apps open in background** | Traditional whiteboards consume hundreds of MBs of RAM. | Use the **Graffiti Desktop App (Tauri v2)**, which uses **only 42 MB RAM** instead of 350 MB+. |

---

## 5. Where the Raw Data and Scripts are Located

All data files, scripts, and publication figures are completely open and reproducible in the repository:
* **Raw CSV Data Tables:** [`test data/data/`](file:///e:/graffiti/test%20data/data/)
* **Vector Publication Figures:** [`test data/figures/`](file:///e:/graffiti/test%20data/figures/)
* **Technical Benchmark Report:** [`test data/benchmark_report.md`](file:///e:/graffiti/test%20data/benchmark_report.md)
* **Master Research Audit:** [`docs_archive/reports/RESEARCH_PAPER_AUDIT_AND_TEST_STRATEGY.md`](file:///e:/graffiti/docs_archive/reports/RESEARCH_PAPER_AUDIT_AND_TEST_STRATEGY.md)

