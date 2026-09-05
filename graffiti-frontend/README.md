# Graffiti Frontend — Real-Time Collaborative Canvas & Desktop UI

The frontend client and native desktop app for Graffiti, built with **React 19**, **TypeScript**, **Vite**, and **Tauri v2**. It provides an infinite 2D vector canvas with rough aesthetic rendering, multi-page notebook management with paper background templates, local-first optimistic CRDT synchronization, Google Drive export, and hardware-accelerated desktop integration for Windows, macOS, and Linux.

---

## Architecture & Module Structure

```
graffiti-frontend/
├── index.html                      # Entry HTML
├── package.json                    # Dependencies (React 19, Vite, @stomp/stompjs, roughjs, jspdf)
├── vite.config.ts                  # Vite build & proxy configuration
├── src-tauri/                      # Tauri v2 native cross-platform desktop configuration
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Window framing, Mica/Vibrancy blur, OS menus
│   └── src/main.rs                 # Native desktop entrypoint & file association handler
└── src/
    ├── main.tsx                    # React application bootstrap
    ├── App.tsx                     # Main layout, page bar, and canvas shell
    ├── canvas/                     # Core 2D vector rendering surface
    │   ├── Canvas.tsx              # Main viewport, panning, zooming, and render loop
    │   ├── renderer.ts             # Rough-style vector shape procedural rendering
    │   ├── paperTemplates.ts       # Ruled (28px), Grid (20x20), Dotted, Cornell backgrounds
    │   ├── bounds.ts               # Bounding box calculation & hit detection
    │   ├── fractionalIndex.ts      # Fractional indexing for conflict-free z-ordering
    │   ├── minimap.tsx             # Interactive 160x100 navigation minimap (Alt+M)
    │   ├── tidyUp.ts               # Multi-element auto-align & grid distribution engine (Ctrl+Alt+T)
    │   └── stickyNotes.ts          # Preset pastel sticky notes & auto-bound text engine (N)
    ├── notebook/                   # Multi-page notebook manager
    │   ├── pageStore.ts            # Ordered page list (id, title, template, order)
    │   ├── PageBar.tsx             # Bottom page-bar ([ ◀ Page 1 of 5 ▶ ], + Add Page)
    │   └── SlideDrawer.tsx         # Collapsible sidebar with live page thumbnails
    ├── export/                     # Multi-format document compilation
    │   ├── pdfCompiler.ts          # Multi-page high-DPI PDF generation via jsPDF
    │   ├── markdownExporter.ts     # Lecture notes text aggregator (.md)
    │   └── driveUploader.ts        # 1-Click Google Drive upload & shareable link modal
    ├── crdt/                       # Client-side CRDT state & reconciliation
    │   ├── sceneStore.ts           # In-memory scene store (Shape ID -> Element)
    │   ├── reconcile.ts            # Optimistic local vs remote conflict resolution
    │   └── history.ts              # Local undo/redo stack
    ├── collab/                     # Real-time synchronization
    │   ├── stompClient.ts          # STOMP over SockJS client wrapper (/ws)
    │   ├── presence.ts             # Ephemeral cursor tracking & 30ms throttled broadcaster
    │   └── roomManager.ts          # Room rehydration via GET /rooms/{slug}
    ├── voice/                      # Browser Web Speech integration
    │   ├── voiceCommander.ts       # SpeechRecognition hook & phrase intent parser
    │   └── VoiceHud.tsx            # Non-intrusive bottom HUD pill & feedback toast
    ├── ai/                         # Multimodal AI whiteboard features
    │   ├── searchModal.tsx         # Unified Canvas Search (Ctrl+F) for text & OCR strokes
    │   ├── strokeBeautifier.ts     # Douglas-Peucker & geometric shape snap-on-hold
    │   ├── mathSolver.ts           # Live handwritten equation extraction & result placement
    │   ├── circleGesture.ts        # "Circle to Ask/Modify" closed-loop gesture detection
    │   └── ghostOverlay.tsx        # Translucent AI suggestion preview with Accept/Dismiss
    ├── components/                 # Reusable UI components
    │   ├── Toolbar.tsx             # Drawing tools (rect, ellipse, diamond, arrow, sticky, text)
    │   ├── StylePanel.tsx          # Color pickers, pastel presets, stroke width, fill styles
    │   ├── PresenceCursors.tsx     # Overlay canvas rendering collaborator mouse cursors
    │   └── UserAvatarList.tsx      # Active collaborators header list
    └── types/                      # TypeScript element & protocol definitions
        ├── element.ts              # CanvasElement, ShapeType, Point, Bounds, StickyNote
        ├── page.ts                 # RoomPage, PaperTemplate ('ruled' | 'grid' | 'dotted' | 'cornell')
        ├── op.ts                   # OpRequestDTO, OpBroadcastDTO, OpType
        └── presence.ts             # PresenceDTO, CollaboratorState
```

---

## Core Capabilities

### 1. Multi-Page Notebook & Classroom Presentation
- **Page Management**: Switch pages seamlessly (`◀ Page 1 of 5 ▶`), add pages (`Ctrl+Shift+N`), duplicate pages (`Ctrl+Shift+D`), and reorder in the thumbnail slide drawer.
- **Paper Background Templates**:
  - *Ruled / Lined Paper*: 28px horizontal line intervals for handwriting and note-taking.
  - *Grid Paper*: 20×20px orthogonal math and engineering grid.
  - *Dotted Matrix*: 24×24px dot pattern for sketches and bullet notes.
  - *Cornell Notes*: 2.5-inch vertical cue margin on left + 2-inch bottom summary box.
- **Teacher Follow-Me Sync**: Teacher navigation automatically flips all student viewports to the active page via `TEACHER_PAGE_SYNC` presence events.

### 2. Multi-Format & Google Drive Export
- **Multi-Page PDF**: Compiles all notebook pages sequentially into a high-DPI `.pdf`.
- **1-Click Google Drive Upload**: Directly uploads the compiled PDF to the user's Google Drive via OAuth2 scope (`drive.file`) and displays an instant public share link.
- **Markdown Lecture Notes**: Exports all typed text and OCR-extracted handwriting (`customData.ocrText`) into a clean `.md` document.

### 3. Native Desktop Application (Tauri v2 & 100% Offline Mode)
- **Zero Server Requirement**: Functions completely standalone without any running backend servers, databases, or network connection. All notebooks, pages, whiteboards, workspaces, and folders persist locally in OS AppData (`IndexedDB`).
- **Frameless Window Styling**: Embedded macOS traffic lights with glassmorphism / Windows 11 Mica material.
- **OS System Menus**: Top menu bar (`File`, `Edit`, `View`, `Tools`, `Help`) with accelerator keybindings (`Cmd/Ctrl+S`, `Cmd/Ctrl+O`, `Cmd+,`).
- **OS File Association**: Double-click `.graffiti` files in Finder/Explorer to open directly.
- **Offline Local File Mode**: Open and save files directly to the local hard drive via native OS file dialogs.

### 4. Layout Superpowers & AI Workflows
- **Sticky Note Presets (`N`)**: 200×200px square notes with pastel palettes (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) and auto-expanding centered text.
- **Canvas Minimap (`Alt+M`)**: Scaled overview thumbnail with draggable viewport frame.
- **"Tidy Up" Grid Engine (`Ctrl+Alt+T`)**: Multi-shape geometry layout organizing selections into clean grids with 24px uniform spacing.
- **Live Math Solver**: Detects equations ending in `=`, evaluates via `sympy`, and places digital answer text adjacent to the `=` sign.
- **Voice-Driven Commands**: Native Web Speech recognition for hands-free tool switching, color selection, and page navigation.
- **"Circle to Ask/Modify" Gesture AI**: Drawing a closed loop triggers contextual LLM prompts (Ask, Restyle, Transform) rendered as non-destructive Ghost Previews.

---

## Development & Desktop Execution

```bash
# 1. Install dependencies
npm install

# 2. Run Web Development Server
npm run dev

# 3. Run Native Desktop App (Connects to running Vite dev server)
npx tauri dev --no-dev-server

# 4. Or Run Compiled Desktop App Directly (No servers or terminal needed)
.\src-tauri\target\debug\graffiti-desktop.exe

# 5. Build Native Desktop Installers (.exe, .dmg, .AppImage)
npm run desktop:build
```
Web client runs on `http://localhost:5173`. Desktop launches in a native hardware-accelerated window and functions 100% offline.
