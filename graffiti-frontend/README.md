# Graffiti Frontend — Real-Time Collaborative Canvas UI

The frontend client for Graffiti, built with **React 19**, **TypeScript**, and **Vite**. It provides a high-performance, infinite 2D vector canvas with hand-drawn aesthetic rendering, local-first optimistic state management, STOMP WebSocket synchronization, and intelligent AI-assisted whiteboard interactions.

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
    │   └── fractionalIndex.ts      # Fractional indexing for conflict-free z-ordering
    ├── crdt/                       # Client-side CRDT state & reconciliation
    │   ├── sceneStore.ts           # In-memory scene store (Shape ID -> Element)
    │   ├── reconcile.ts            # Optimistic local vs remote conflict resolution
    │   └── history.ts              # Local undo/redo stack
    ├── collab/                     # Real-time synchronization
    │   ├── stompClient.ts          # STOMP over SockJS client wrapper (/ws)
    │   ├── presence.ts             # Ephemeral cursor tracking & 30ms throttled broadcaster
    │   └── roomManager.ts          # Room rehydration via GET /rooms/{slug}
    ├── ai/                         # Multimodal AI whiteboard features
    │   ├── searchModal.tsx         # Unified Canvas Search (Ctrl+F) for text & OCR strokes
    │   ├── strokeBeautifier.ts     # Douglas-Peucker & geometric shape snap-on-hold
    │   ├── circleGesture.ts        # "Circle to Ask/Modify" closed-loop gesture detection
    │   └── ghostOverlay.tsx        # Translucent AI suggestion preview with Accept/Dismiss
    ├── components/                 # Reusable UI components
    │   ├── Toolbar.tsx             # Drawing tools (rect, ellipse, diamond, arrow, freedraw, text)
    │   ├── StylePanel.tsx          # Color pickers, stroke width, fill styles (hachure/solid)
    │   ├── PresenceCursors.tsx     # Overlay canvas rendering collaborator mouse cursors
    │   └── UserAvatarList.tsx      # Active collaborators header list
    └── types/                      # TypeScript element & protocol definitions
        ├── element.ts              # CanvasElement, ShapeType, Point, Bounds
        ├── op.ts                   # OpRequestDTO, OpBroadcastDTO, OpType
        └── presence.ts             # PresenceDTO, CollaboratorState
```

---

## Core Capabilities

### 1. 2D Vector Canvas & Hand-Drawn Rendering
- Infinite 2D grid with smooth sub-pixel panning, zooming (10% to 500%), and viewport transform matrix.
- Procedural hand-drawn rough rendering for primitives (`rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `freedraw`, `text`).
- Conflict-free layer ordering using string **fractional indexing** (`"a0"`, `"a1"`, `"a05"`).

### 2. Local-First Optimistic Synchronization
- Canvas edits immediately mutate local scene state, increment `element.version`, regenerate `element.versionNonce`, and send an `OpRequestDTO` to the backend over STOMP (`/app/rooms/{slug}/op`).
- Incoming remote operations are reconciled against local active states:
  - If the local shape is actively being edited (`resizing`, `editingText`, `drawing`): local state is retained.
  - If `local.version > remote.version`: local state is retained.
  - If versions are identical, the lowest `versionNonce` wins deterministically.

### 3. Ephemeral Presence & Collaborative Cursors
- Mouse coordinates, active element selections, and laser pointer trails are throttled to 30ms (via `requestAnimationFrame`) and transmitted over `/app/rooms/{slug}/presence`.
- Cursors render on a dedicated high-frame-rate overlay canvas layer with colored collaborator badges.

### 4. Intelligent AI Whiteboard Interactions
- **Canvas Search (`Ctrl+F`)**: Unified spatial search dialog indexing typed text and OCR-extracted handwriting strokes (`customData.ocrText`), featuring smooth auto-pan/zoom to matching bounding boxes.
- **Stroke Beautification**: Real-time Douglas-Peucker point decimation and geometric classification snapping irregular hand-drawn loops into clean vector rectangles, ellipses, diamonds, or smoothed Bezier splines upon hold.
- **"Circle to Ask / Modify / Change" Gesture AI**: Drawing a closed loop around any group of canvas elements activates a contextual AI prompt bar for explaining, restyling, or transforming the selected diagram.
- **Ghost Preview Overlay**: AI suggestions render as non-destructive translucent overlays with **Accept (Enter)** and **Dismiss (Esc)** actions.

---

## Getting Started

### Prerequisites
- Node.js 20+ / 22+
- Backend running on `http://localhost:8080` (or configured via environment)

### Installation & Development
```bash
# Install dependencies
npm install

# Start local Vite development server (port 5173)
npm run dev

# Run TypeScript typecheck and lint
npm run lint

# Build production bundle
npm run build
```

---

## Environment Configuration (`.env`)

```ini
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_STOMP_URL=ws://localhost:8080/ws
VITE_AI_SERVICE_URL=http://localhost:8000
```
