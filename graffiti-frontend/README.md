# Graffiti Frontend — Real-Time Collaborative Canvas UI

The frontend client for Graffiti, built with **React 19**, **TypeScript**, and **Vite**. It provides a high-performance, infinite 2D vector canvas with hand-drawn aesthetic rendering, local-first optimistic state management, STOMP WebSocket synchronization, layout superpowers (minimap, sticky notes, tidy-up), and intelligent AI-assisted whiteboard interactions.

---

## Architecture & Key Modules

```
graffiti-frontend/
├── index.html                      # Entry HTML
├── package.json                    # Dependencies (React 19, Vite, @stomp/stompjs, roughjs)
├── vite.config.ts                  # Vite build & proxy configuration
└── src/
    ├── main.tsx                    # React application bootstrap
    ├── App.tsx                     # Main layout & canvas shell
    ├── canvas/                     # Core 2D vector rendering surface
    │   ├── Canvas.tsx              # Main viewport, panning, zooming, and render loop
    │   ├── renderer.ts             # Rough-style vector shape procedural rendering
    │   ├── bounds.ts               # Bounding box calculation & hit detection
    │   ├── fractionalIndex.ts      # Fractional indexing for conflict-free z-ordering
    │   ├── minimap.tsx             # Interactive 160x100 navigation minimap (Alt+M)
    │   ├── tidyUp.ts               # Multi-element auto-align & grid distribution engine (Ctrl+Alt+T)
    │   └── stickyNotes.ts          # Preset pastel sticky notes & auto-bound text engine (N)
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
        ├── op.ts                   # OpRequestDTO, OpBroadcastDTO, OpType
        └── presence.ts             # PresenceDTO, CollaboratorState
```

---

## Core Capabilities

### 1. 2D Vector Canvas & Hand-Drawn Rendering
- Infinite 2D grid with smooth sub-pixel panning, zooming (10% to 500%), and viewport transform matrix.
- Procedural hand-drawn rough rendering for primitives (`rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `freedraw`, `text`, `image`).
- Conflict-free layer ordering using string **fractional indexing** (`"a0"`, `"a1"`, `"a05"`).

### 2. Layout Superpowers (Minimap, Sticky Notes, Tidy Up)
- **Sticky Note Presets (`N`)**: Instant 200×200px square notes with pastel color palettes (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) and auto-expanding centered text.
- **Canvas Minimap (`Alt+M`)**: Scaled overview thumbnail in the bottom corner with click-to-pan and draggable viewport bounds.
- **"Tidy Up" Grid Engine (`Ctrl+Alt+T`)**: Multi-shape geometry engine organizing scattered selections into clean grids, columns, or rows with 24px uniform spacing.

### 3. Local-First Optimistic Synchronization
- Canvas edits immediately mutate local scene state, increment `element.version`, regenerate `element.versionNonce`, and send an `OpRequestDTO` to the backend over STOMP (`/app/rooms/{slug}/op`).
- Incoming remote operations are reconciled against local active states:
  - If the local shape is actively being edited (`resizing`, `editingText`, `drawing`): local state is retained.
  - If `local.version > remote.version`: local state is retained.
  - If versions are identical, the lowest `versionNonce` wins deterministically.

### 4. Voice-Driven Canvas Commands (Web Speech API)
- Client-side voice recognition via browser native `SpeechRecognition` API (zero backend audio streaming).
- Push-to-talk (`M`) or toolbar mic toggle to trigger tools (*"select pen"*, *"sticky note"*), colors (*"color blue"*), navigation (*"zoom to fit"*), and actions (*"tidy up"*, *"export png"*).

### 5. Multimodal AI Workflows
- **Handwriting OCR Search (`Ctrl+F`)**: Unified canvas search matching typed text and handwriting strokes with smooth camera focusing.
- **Stroke Beautification**: Douglas-Peucker point decimation snapping rough sketches into crisp vector shapes upon hold (400ms).
- **Live Handwritten Math Solver**: Detects equations ending in `=`, evaluates via `sympy`, and places digital answer text adjacent to the `=` sign.
- **"Circle to Ask/Modify" Gesture AI**: Drawing a closed loop triggers contextual LLM prompts (Ask, Restyle, Transform) rendered as non-destructive Ghost Previews with **Accept (Enter)** and **Dismiss (Esc)**.

---

## Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build production bundle
npm run build
```
Client runs on `http://localhost:5173`.
