# Real-Time Collaborative Whiteboard with AI Assist — Project Specification

**Status:** Approved Master Architecture & Shared Engineering Contract  
**Purpose:** Define the comprehensive system architecture, data models, real-time sync protocol, canvas element schemas, complete feature matrix, keyboard shortcut specification, and subteam interfaces (Backend/Sync, Frontend Canvas, AI/ML Service) for progressive, end-to-end implementation. Written to serve directly as an authoritative technical blueprint for team members and AI coding assistants (Claude, Copilot, Antigravity) to scaffold and implement every layer with high fidelity.

---

## 1. Product Overview & Progressive Delivery Model

Graffiti is a high-performance, horizontally scalable real-time collaborative whiteboard web application. Multiple distributed users can draw, write, manipulate shapes, and organize complex diagrams concurrently on a shared infinite canvas without central locks or perceptible lag.

### 1.1 Progressive Architecture Philosophy
The system is architected to be built **progressively across distinct, verifiable layers**:
1. **Layer 1 (Core Canvas, Layout Tools & Single-Room State)**: Standalone 2D vector canvas with hand-drawn rough styling, discrete element schemas, complete keyboard shortcuts, sticky note presets, canvas navigation minimap, multi-shape "Tidy Up" alignment engine, and optimistic local manipulation.
2. **Layer 2 (Real-Time Synchronization & CRDT)**: Monotonically ordered Last-Writer-Wins (LWW) CRDT engine, STOMP WebSockets, and append-only database persistence for deterministic multi-user convergence.
3. **Layer 3 (Distributed Scale & Compaction)**: Multi-instance Redis Pub/Sub event broadcasting, distributed lock snapshot compaction, and role-based authentication (JWT + Google OAuth2).
4. **Layer 4 (Intelligent Canvas & Multimodal AI Assist)**: Asynchronous microservice & client-side intelligent interactions:
   - **Handwriting & Canvas Text Search (`Ctrl+F`)**: Unified canvas search indexing both typed text and hand-drawn strokes via OCR/embeddings with auto-pan/zoom.
   - **Stroke Beautification & Shape Smoothing**: Snapping irregular hand-drawn loops, strokes, and polygons into smooth geometric primitives or splines upon hold.
   - **Live Handwritten Math & Equation Solver**: Automatic OCR extraction of handwritten arithmetic and algebra ending in `=`, evaluated via symbolic math engine (`sympy`) and placed adjacent as digital text.
   - **Voice-Driven Canvas Commands**: Browser-native Web Speech recognition translating spoken phrases into instant canvas tool actions, color changes, and export commands with zero backend audio streaming.
   - **"Circle to Ask / Modify / Change" Gesture AI**: Drawing a closed loop around any canvas area to contextually query, restyle, or transform enclosed elements using multimodal LLMs.
   - **Natural Language Diagram Synthesis**: Generating complete structured flowcharts and system diagrams from text prompts.

### 1.2 Core System Engineering Goals
- **Real-Time Collaboration**: Sub-50ms sync latency with zero lost edits under high-concurrency editing.
- **Deterministic Convergence**: LWW Element-Set reducer guarantees mathematically identical canvas state across all replicas regardless of network packet reordering or duplicate delivery.
- **Presence vs. Persistence Segregation**: High-frequency ephemeral events (mouse cursors, selection bounds, laser trails) stream directly over Redis Pub/Sub without causing database disk I/O bloat.
- **Snapshot Compaction**: Append-only operation logs in PostgreSQL are compacted periodically into JSONB snapshots using Redis distributed locks (`SET NX PX`).
- **Non-Destructive AI UX**: AI suggestions render as non-destructive ghost overlays with explicit **Accept (Enter)** and **Dismiss (Esc)** actions, ensuring AI operations never silently overwrite human edits.
- **Horizontal Scalability**: Stateless backend cluster coordinated through Redis 7.

---

## 2. Feature Support & Capability Matrix

### 2.1 Core Canvas & Editor Capabilities

| Feature | Implementation Specification |
| :--- | :--- |
| **Free & Open-Source** | Core codebase is open-source under the MIT license and fully self-hostable. |
| **Infinite 2D Canvas** | Virtualized coordinate plane with subpixel matrix pan/zoom (10% to 500%). |
| **Hand-Drawn Aesthetic** | Procedural rough stroke generation with customizable roughness, bowing, and jitter. |
| **Dark / Light Mode** | Dynamic theme switching (`Alt+Shift+D`), CSS custom property tokens, and canvas color palette adaptation. |
| **Customizable Styles** | Stroke colors, background colors, fill styles (`hachure`, `solid`, `cross-hatch`, `zigzag`), stroke widths, opacity. |
| **Sticky Note Presets** | Dedicated Sticky Note tool (`N`) creating square notes with curated pastel palette presets (`#fff3bf`, `#d0ebff`, `#d3f9d8`, `#ffdeeb`, `#f3d9fa`, `#ffe8cc`) and auto-focused centered text. |
| **Canvas Navigation Minimap** | Interactive 160×100px overview thumbnail (`Alt+M`) rendering scaled scene bounds with click-to-pan and draggable viewport rectangle. |
| **"Tidy Up" & Auto-Alignment** | Multi-selection layout engine (`Ctrl+Alt+T`) calculating bounding boxes and evenly distributing elements into clean rows, columns, or uniform grids with 24px gaps. |
| **Image Support** | Image elements (`type: "image"`), drag-and-drop file upload, cropping/resizing, bounding box persistence. |
| **Export to PNG, SVG, Clipboard** | Off-screen canvas serialization to PNG blob, SVG vector string, and direct OS clipboard copy (`Shift+Alt+C`). |
| **Open Format JSON Export/Import** | Standardized `.graffiti` JSON scene export and full rehydration import. |
| **Tool Palette** | Rectangle (`R`), Diamond (`D`), Ellipse (`O`), Arrow (`A`), Line (`L`), Free-draw (`P`), Text (`T`), Sticky Note (`N`), Eraser (`E`), Frame (`F`), Laser (`K`), Bucket Fill (`B`). |
| **Arrow-Binding & Labeled Arrows** | Dynamic anchor binding to target shape IDs via `boundElements` array with auto-recalculating tangents and text labels. |
| **Undo / Redo Stack** | Multi-user aware local op stack (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`). |
| **Zoom and Panning** | Smooth trackpad pinch, mouse wheel drag, Spacebar pan, Zoom to fit (`Shift+1`), Zoom to selection (`Shift+2`). |

### 2.2 Multi-User Collaboration & Workspace Capabilities

| Feature | Implementation Specification |
| :--- | :--- |
| **Real-Time Multi-User Editing** | Sub-50ms sync via STOMP WebSockets, Redis Pub/Sub, and LWW CRDT engine. |
| **Share Link (Guest / Room Sharing)** | Instant shareable room URLs (`/rooms/{slug}`) for anonymous and authenticated collaboration. |
| **Role-Based Access Control (RBAC)** | 3-tier room permissions: `OWNER` (admin/claim), `EDITOR` (draw/edit ops), `VIEWER` (read-only canvas). |
| **Ephemeral Presence & Cursors** | Live multiplayer cursors, laser trails, and selection bounds over Redis Pub/Sub without database bloat. |
| **Append-Only History & Compaction** | PostgreSQL immutable op log + periodic background JSONB snapshot compaction with Redis distributed locks. |
| **User Accounts & Google OAuth2** | Email/password registration, stateless JWT bearer tokens, and Google OAuth2 login. |
| **Room Ownership Claiming** | Logged-in users can claim anonymous rooms (`POST /rooms/{slug}/claim`). |

### 2.3 Intelligent AI/ML Multimodal Capabilities

| Feature | Implementation Specification |
| :--- | :--- |
| **Handwriting OCR & Canvas Search (`Ctrl+F`)** | Asynchronous stroke OCR extraction indexing `freedraw` notes with smooth auto-pan/zoom to matching bounding boxes. |
| **Stroke Beautification & Shape Smoothing** | Douglas-Peucker point decimation, geometric classification, and Catmull-Rom/Bezier curve smoothing (Auto-Snap on Hold). |
| **Live Handwritten Math & Equation Solver** | OCR extraction of handwritten arithmetic and algebra ending in `=`, evaluated via symbolic Python engine (`sympy`) and rendered adjacent as digital text. |
| **Voice-Driven Canvas Commands** | Browser-native Web Speech recognition translating spoken commands into tool changes, color selections, and canvas actions with zero backend audio load. |
| **"Circle to Ask / Modify / Change" Gesture AI** | Drawing a closed loop around any canvas area extracts spatial context and triggers interactive AI queries, restyling, or transformations. |
| **Text-to-Diagram Synthesis** | Synthesizing structured flowcharts and architecture diagrams from natural language prompts via Mermaid/Sugiyama layout. |
| **Non-Destructive Ghost Overlays** | All AI operations render as preview overlays with **Accept (Enter)** and **Dismiss (Esc)** actions. |

---

## 3. Comprehensive Keyboard Shortcuts Specification

### 3.1 Tools Shortcuts
| Action | Keybinding |
| :--- | :--- |
| **Hand (Panning tool)** | `H` |
| **Selection tool** | `V` or `1` |
| **Rectangle** | `R` or `2` |
| **Diamond** | `D` or `3` |
| **Ellipse / Circle** | `O` or `4` |
| **Arrow** | `A` or `5` |
| **Line** | `L` or `6` |
| **Draw (Freedraw pen)** | `P` or `7` |
| **Sticky Note** | `N` |
| **Text tool** | `T` or `8` |
| **Insert image** | `9` |
| **Eraser** | `E` or `0` |
| **Frame tool** | `F` |
| **Laser pointer** | `K` |
| **Bucket fill** | `B` |
| **Voice Command Listening (Push to Talk)** | `M` or Mic Toolbar Button |
| **Pick color from canvas** | `I` / `Shift+S` / `Shift+G` |
| **Edit line/arrow points** | `Ctrl + Enter` |
| **Edit text / add label** | `Enter` |
| **Add new line (text editor)** | `Enter` or `Shift + Enter` |
| **Finish editing (text editor)** | `Esc` or `Ctrl + Enter` |
| **Curved arrow** | `A` + click + click + click |
| **Curved line** | `L` + click + click + click |
| **Crop image** | `Double-click` or `Enter` |
| **Finish image cropping** | `Enter` or `Esc` |
| **Keep selected tool active after drawing** | `Q` |
| **Prevent arrow binding** | Hold `Ctrl` while drawing arrow |
| **Add / Update link for selected shape** | `Ctrl + K` |
| **Toggle shape type** | `Tab` or `Shift + Tab` |

### 3.2 View & Navigation Shortcuts
| Action | Keybinding |
| :--- | :--- |
| **Zoom in** | `Ctrl + +` |
| **Zoom out** | `Ctrl + -` |
| **Reset zoom (100%)** | `Ctrl + 0` |
| **Zoom to fit all elements** | `Shift + 1` |
| **Zoom to selection** | `Shift + 2` |
| **Toggle Navigation Minimap** | `Alt + M` |
| **Move page up / down** | `PgUp` / `PgDn` |
| **Move page left / right** | `Shift + PgUp` / `Shift + PgDn` |
| **Zen mode (hide toolbars)** | `Alt + Z` |
| **Snap to objects / grid** | `Alt + S` |
| **Toggle grid** | `Ctrl + '` |
| **View mode (read-only)** | `Alt + R` |
| **Toggle light/dark theme** | `Alt + Shift + D` |
| **Canvas & shape properties** | `Alt + /` |
| **Find on canvas (text + handwriting OCR)** | `Ctrl + F` |
| **Command palette** | `Ctrl + /` or `Ctrl + Shift + P` |

### 3.3 Editor & Manipulation Shortcuts
| Action | Keybinding |
| :--- | :--- |
| **Tidy Up / Auto-Distribute Selection** | `Ctrl + Alt + T` |
| **Solve Handwritten Equation on Selection** | `Ctrl + Shift + M` (or automatic on `=`) |
| **Create connected flowchart element** | `Ctrl + Arrow Key` |
| **Navigate flowchart** | `Alt + Arrow Key` |
| **Move canvas** | `Space + drag` or `Wheel + drag` |
| **Reset canvas** | `Ctrl + Delete` |
| **Delete selected elements** | `Delete` or `Backspace` |
| **Cut** | `Ctrl + X` |
| **Copy** | `Ctrl + C` |
| **Paste** | `Ctrl + V` |
| **Paste as plaintext** | `Ctrl + Shift + V` |
| **Select all** | `Ctrl + A` |
| **Add element to selection** | `Shift + click` |
| **Deep select inside group** | `Ctrl + click` |
| **Deep select within box (prevent drag)** | `Ctrl + drag` |
| **Copy selection to clipboard as PNG** | `Shift + Alt + C` |
| **Copy shape styles** | `Ctrl + Alt + C` |
| **Paste shape styles** | `Ctrl + Alt + V` |
| **Send to back** | `Ctrl + Shift + [` |
| **Send backward** | `Ctrl + [` |
| **Bring forward** | `Ctrl + ]` |
| **Bring to front** | `Ctrl + Shift + ]` |
| **Align top / bottom / left / right** | `Ctrl + Shift + Up / Down / Left / Right` |
| **Duplicate** | `Ctrl + D` or `Alt + drag` |
| **Lock / unlock selection** | `Ctrl + Shift + L` |
| **Undo** | `Ctrl + Z` |
| **Redo** | `Ctrl + Y` or `Ctrl + Shift + Z` |
| **Group selection** | `Ctrl + G` |
| **Ungroup selection** | `Ctrl + Shift + G` |
| **Flip horizontal** | `Shift + H` |
| **Flip vertical** | `Shift + V` |
| **Show stroke color picker** | `S` |
| **Show background color picker** | `G` |
| **Show font picker** | `Shift + F` |
| **Decrease / Increase font size** | `Ctrl + Shift + <` / `Ctrl + Shift + >` |

---

## 4. System Architecture & Multi-Tier Topology

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                Frontend Clients                                  │
│                 (React + Canvas Rendering Engine + STOMP Client)                 │
└──────────────┬────────────────────────────────────────────────────┬──────────────┘
               │                                                    │
      REST (Rooms/Auth/Search)                             STOMP WebSocket (Ops/Presence)
               │                                                    │
               ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         Spring Boot 4.1.0 Node Cluster                           │
│                          (Java 25 Runtime / Port 8080)                           │
│  ┌───────────────────────┐ ┌─────────────────────────┐ ┌──────────────────────┐  │
│  │ Room & Auth REST API  │ │ STOMP MessageController │ │ Compaction Worker    │  │
│  │ (JWT / Google OAuth2) │ │ (/app/rooms/{slug}/*)   │ │ (Redis Distributed)  │  │
│  └───────────────────────┘ └─────────────────────────┘ └──────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │             CRDT Merge Engine (LWW-Element-Set Reducer)                    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────┬────────────────────────┬──────────────┘
               │                           │                        │
        Database Ops                 Pub/Sub & Locks          Internal Callback
               │                           │                        │
               ▼                           ▼                        ▼
┌─────────────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐
│        PostgreSQL 16        │ │       Redis 7        │ │      AI/ML Service      │
│  - ops (Append-only JSONB)  │ │ - room:{slug}:op     │ │    (FastAPI / Python)   │
│  - snapshots (State JSONB)  │ │ - room:{slug}:pres.. │ │ - Handwriting OCR Search│
│  - rooms, users, members    │ │ - lock:compact:{id}  │ │ - Stroke Beautification │
│                             │ │                      │ │ - Live Math Solver      │
│                             │ │                      │ │ - Circle-to-Edit Engine │
│                             │ │                      │ │ - Text-to-Diagram (LLM) │
└─────────────────────────────┘ └──────────────────────┘ └─────────────────────────┘
```

### Subsystem Responsibilities
1. **Backend / Sync Engine (`graffiti-backend/`)**: Java 25 & Spring Boot. Owns room management, JWT/OAuth2 authentication, STOMP WebSocket broker, PostgreSQL persistence, Redis Pub/Sub relay, snapshot compaction with distributed locks, and CRDT merge reduction.
2. **Frontend Canvas (`graffiti-frontend/`)**: React + TypeScript. Implements the 2D vector canvas (referencing `docs_archive/`), Rough-style procedural rendering, sticky note presets, canvas minimap, tidy-up layout algorithms, Web Speech command recognition, optimistic local mutations, fractional-index z-ordering, multi-user presence, and the AI ghost preview overlay.
3. **AI/ML Service (`graffiti-aiml/`)**: Python (FastAPI). Asynchronously processes stroke beautification, handwriting recognition, live equation solving via `sympy`, canvas search indexing, and circle-to-edit multimodal workflows, returning proposed operations to the backend callback API.

---

## 5. Canvas Data Model & CRDT Merge Semantics

### 5.1 Canvas Element Schema (Shape Contract)
Every visual object on the whiteboard conforms to a standardized, discrete JSON element contract (derived from the reference canvas architecture in `docs_archive`):

```json
{
  "id": "el_k9J2xLpQ8v1M",
  "type": "rectangle",
  "x": 240,
  "y": 180,
  "width": 160,
  "height": 90,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "roundness": { "type": 3 },
  "seed": 104729482,
  "version": 4,
  "versionNonce": 839281,
  "index": "a0",
  "isDeleted": false,
  "groupIds": [],
  "frameId": null,
  "boundElements": [
    { "id": "arrow_7x9LmP", "type": "arrow" }
  ],
  "updated": 1725184800000,
  "link": null,
  "locked": false,
  "customData": {
    "ocrText": "Authentication Service",
    "aiGenerated": false,
    "smoothedFromStroke": true,
    "isStickyNote": false,
    "mathSolved": false
  }
}
```

#### Supported Shape Types (`type`)
- `rectangle`, `diamond`, `ellipse` (basic geometric containers)
- `arrow`, `line` (linear connectors with relative `points: [[0,0], [dx,dy]]` and binding references)
- `freedraw` (hand-drawn strokes with `points: [...]`, `pressures: [...]`, `simulatePressure: boolean`)
- `text` (typed text with `text`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign`)
- `image` (`fileId`, `status`, `scale`, `mimeType`)
- `frame` (structural bounding container for grouping related diagram sections)
- `embeddable` / `iframe` (interactive web content embeds)

#### Type-Specific Required Fields
All shape types share the common base fields shown in the schema above (`id`, `x`, `y`, `angle`, `strokeColor`, `opacity`, `version`, `versionNonce`, `index`, `isDeleted`, `groupIds`, `boundElements`, `updated`). The table below lists the **additional fields required per type**:

| Type | Required Additional Fields |
| :--- | :--- |
| `rectangle` / `diamond` / `ellipse` | `width`, `height`, `fillStyle`, `roundness` |
| `arrow` / `line` | `points` (array of `[dx, dy]` relative to `x,y`), `startBinding`, `endBinding` (nullable `{elementId, focus, gap}`) |
| `freedraw` | `points`, `pressures`, `simulatePressure`, `lastCommittedPoint` |
| `text` | `text`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign`, `containerId` (nullable, for bound labels) |
| `image` | `fileId`, `status` (`pending` \| `saved` \| `error`), `scale: [scaleX, scaleY]`, `mimeType` |
| `frame` | `name`, `childrenIds` (array of contained element IDs) |
| `embeddable` / `iframe` | `link`, `width`, `height` |

---

### 5.2 Persistent Operation Entity (`Op`)

Structural canvas mutations (`CREATE_OR_UPDATE` and `DELETE`) are persisted into PostgreSQL as immutable append-only events:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "roomId": "e0b57e79-52d3-488f-9a1d-7203e8ff0938",
  "shapeId": "el_k9J2xLpQ8v1M",
  "opType": "CREATE_OR_UPDATE",
  "payload": {
    "id": "el_k9J2xLpQ8v1M",
    "type": "rectangle",
    "x": 250,
    "y": 180,
    "width": 160,
    "height": 90,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#a5d8ff",
    "version": 5,
    "versionNonce": 918273,
    "isDeleted": false
  },
  "lamportTs": 43,
  "authorId": "usr_991823ab",
  "createdAt": "2026-09-01T08:30:00.000Z"
}
```

#### Database Table: `ops`
```sql
CREATE TABLE ops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    shape_id VARCHAR(255) NOT NULL,
    op_type VARCHAR(32) NOT NULL, -- 'CREATE_OR_UPDATE' or 'DELETE'
    payload JSONB NOT NULL,
    lamport_ts BIGINT NOT NULL,
    author_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ops_room_lamport ON ops (room_id, lamport_ts ASC);
```

---

### 5.3 CRDT State Representation & LWW Reducer

The active state of each canvas shape is represented on the backend as a `ShapeState`:

```java
public class ShapeState {
    private String shapeId;
    private JsonNode payload;
    private Long lamportTs;
    private String authorId;
    private boolean deleted;
}
```

#### LWW-Element-Set Merge Logic (`CrdtMergeService`):
1. **Per-Shape Independent Register**: Each unique `shapeId` is managed as an independent LWW register.
2. **Tuple Ordering $(LamportTimestamp, AuthorID)$**: For an incoming operation $O$ against existing state $S$ for `shapeId`:
   - If $S$ does not exist: **Apply $O$**.
   - If $O.\text{lamportTs} > S.\text{lamportTs}$: **Apply $O$**.
   - If $O.\text{lamportTs} == S.\text{lamportTs}$: **Tiebreak on Author ID** $\rightarrow$ Apply $O$ if $O.\text{authorId}.\text{compareTo}(S.\text{authorId}) > 0$.
   - Otherwise: **Discard $O$ as stale**.
3. **Tombstone Deletion Guarantee**: Deleting a shape emits `opType: "DELETE"` with `deleted: true` and an incremented Lamport timestamp. Because tombstones update the Lamport timestamp, late-arriving concurrent edits with lower timestamps cannot resurrect deleted shapes.
4. **Mathematical Properties**:
   - **Commutative**: $Merge(A, B) \equiv Merge(B, A)$
   - **Associative**: $Merge(Merge(A, B), C) \equiv Merge(A, Merge(B, C))$
   - **Idempotent**: $Merge(A, A) \equiv A$

---

### 5.4 Consolidated Snapshot Entity (`Snapshot`)

Snapshots prevent the operation log from growing indefinitely and allow rapid room rehydration:

```json
{
  "id": "7b8f9e10-1234-4567-89ab-cdef01234567",
  "roomId": "e0b57e79-52d3-488f-9a1d-7203e8ff0938",
  "state": {
    "el_k9J2xLpQ8v1M": {
      "shapeId": "el_k9J2xLpQ8v1M",
      "payload": { "type": "rectangle", "x": 250, "y": 180, "width": 160, "height": 90 },
      "lamportTs": 43,
      "authorId": "usr_991823ab",
      "deleted": false
    }
  },
  "upToLamportTs": 43,
  "createdAt": "2026-09-01T08:35:00.000Z"
}
```

#### Database Table: `snapshots`
```sql
CREATE TABLE snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    up_to_lamport_ts BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_room_lamport ON snapshots (room_id, up_to_lamport_ts DESC);
```

**Retention Policy**: Snapshots are a read-optimization only — creating a snapshot never deletes or mutates rows in the `ops` table. The append-only op log is retained in full for audit purposes as stated in §2.2. Room rehydration (`GET /rooms/{slug}`) reads the latest snapshot plus any ops with `lamport_ts` greater than `up_to_lamport_ts`, rather than replaying the full log from Lamport 0.

---

### 5.5 Ephemeral Presence DTO (`PresenceMessageDTO`)

Mouse cursor movements, laser trails, and active selections are high-frequency events that stream across Redis Pub/Sub directly to connected WebSocket sessions without database disk I/O:

```json
{
  "authorId": "usr_991823ab",
  "type": "cursor", 
  "payload": {
    "x": 450.5,
    "y": 320.0,
    "username": "Ankit",
    "color": "#ff4d4f",
    "selectedElementIds": ["el_k9J2xLpQ8v1M"],
    "laserPath": []
  }
}
```

---

## 6. API & Real-Time Communication Protocols

### 6.1 REST API Specification

| Method | Path | Auth | Description | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new user account | `{"email": "...", "password": "...", "name": "..."}` | `{"token": "jwt...", "user": {"id": "...", "email": "...", "name": "..."}}` |
| `POST` | `/auth/login` | Public | Log into existing account | `{"email": "...", "password": "..."}` | `{"token": "jwt...", "user": {"id": "...", "email": "...", "name": "..."}}` |
| `GET` | `/oauth2/authorization/google` | Public | Initiate Google OAuth2 flow | — | 302 Redirect to Google OAuth Consent |
| `POST` | `/rooms` | Optional | Create new room (anonymous or owned) | — | `{"id": "uuid", "slug": "a1b2c3d4", "ownerId": "uuid | null", "createdAt": "..."}` |
| `GET` | `/rooms/{slug}` | Public | Rehydrate room (snapshot + delta ops) | — | `{"id": "...", "slug": "...", "ownerId": "...", "snapshotState": {...}, "upToLamportTs": 40, "opsSinceSnapshot": [...]}` |
| `POST` | `/rooms/{slug}/claim` | Required | Claim ownership of an anonymous room | — | `{"id": "...", "slug": "...", "ownerId": "...", "createdAt": "..."}` |
| `POST` | `/internal/rooms/{slug}/ai-suggestion` | Internal | Ingest AI-proposed shape operations | `{"shapeId": "...", "opType": "CREATE_OR_UPDATE", "payload": {...}}` | `{"status": "STUBBED_ACCEPTED"}` |

#### 6.1.1 Standard Error Envelope
Every REST endpoint returns errors in a single shared shape:

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "No room exists for slug 'a1b2c3d4'.",
    "status": 404,
    "timestamp": "2026-09-01T08:30:00.000Z"
  }
}
```

| HTTP Status | Meaning | Example `code` values |
| :--- | :--- | :--- |
| `400` | Malformed request body / validation failure | `VALIDATION_ERROR` |
| `401` | Missing or invalid JWT | `UNAUTHENTICATED` |
| `403` | Authenticated but role forbids action | `FORBIDDEN_ROLE` |
| `404` | Resource does not exist | `ROOM_NOT_FOUND`, `USER_NOT_FOUND` |
| `409` | Conflicting state | `ROOM_ALREADY_CLAIMED` |
| `500` | Unhandled server error | `INTERNAL_ERROR` |

---

### 6.2 WebSocket / STOMP Protocol Contract

- **Endpoint**: `ws://localhost:8080/ws` (with SockJS fallback at `http://localhost:8080/ws`)
- **STOMP Connect Header**:
  ```stomp
  CONNECT
  Authorization:Bearer <jwt_token>
  accept-version:1.1,1.2
  heart-beat:10000,10000
  ```

#### 1. Subscribe Destination: `/topic/rooms/{slug}`
- **Server Broadcast Payload (Structural Op)**:
  ```json
  {
    "type": "OP",
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "roomId": "e0b57e79-52d3-488f-9a1d-7203e8ff0938",
    "shapeId": "el_k9J2xLpQ8v1M",
    "opType": "CREATE_OR_UPDATE",
    "payload": { "id": "el_k9J2xLpQ8v1M", "type": "rectangle", "x": 250, "y": 180, "width": 160, "height": 90 },
    "lamportTs": 43,
    "authorId": "usr_991823ab",
    "createdAt": "2026-09-01T08:30:00.000Z"
  }
  ```
- **Server Broadcast Payload (Ephemeral Presence)**:
  ```json
  {
    "type": "PRESENCE",
    "authorId": "usr_991823ab",
    "presenceType": "cursor",
    "payload": { "x": 450.5, "y": 320.0, "username": "Ankit", "color": "#ff4d4f" }
  }
  ```

#### 2. Client Send Structural Op: `/app/rooms/{slug}/op`
```json
{
  "shapeId": "el_k9J2xLpQ8v1M",
  "opType": "CREATE_OR_UPDATE",
  "payload": {
    "id": "el_k9J2xLpQ8v1M",
    "type": "rectangle",
    "x": 250,
    "y": 180,
    "width": 160,
    "height": 90,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "#a5d8ff",
    "version": 5,
    "versionNonce": 918273,
    "isDeleted": false
  },
  "lamportTs": 42,
  "authorId": "usr_991823ab"
}
```

#### 3. Client Send Ephemeral Presence: `/app/rooms/{slug}/presence`
```json
{
  "authorId": "usr_991823ab",
  "type": "cursor",
  "payload": {
    "x": 450.5,
    "y": 320.0,
    "username": "Ankit",
    "color": "#ff4d4f",
    "selectedElementIds": ["el_k9J2xLpQ8v1M"]
  }
}
```

#### 6.2.1 Reconnection Protocol
1. Client detects STOMP disconnect and enters a **reconnecting** state (retaining local state).
2. Retries with exponential backoff: `1s, 2s, 4s, 8s, capped at 30s` (±20% jitter).
3. On reconnect, calls `GET /rooms/{slug}` to rehydrate authoritative snapshot + delta ops, then re-applies unacknowledged local ops with fresh Lamport timestamps.
4. Resubscribes to `/topic/rooms/{slug}` and resumes presence broadcast.

---

### 6.3 Redis Pub/Sub & Distributed Lock Architecture

Multi-instance cluster scaling and background compaction rely on Redis 7:

1. **Pub/Sub Channels**:
   - `room:{slug}:op`: Relays structural operations between cluster nodes.
   - `room:{slug}:presence`: Relays live cursors and join/leave lifecycle events.
2. **Distributed Compaction Lock**:
   - Key: `lock:compact:{roomId}`
   - Value: Unique random UUID per node.
   - Command: `SET lock:compact:{roomId} {uuid} NX PX 30000` (TTL = 30 seconds).
   - Trigger: Occurs when un-compacted ops in PostgreSQL exceed `app.compaction.op-threshold` (default: 50 ops).
   - Safe Release: Validates current lock value matches node UUID before `DEL`.

---

## 7. Frontend Canvas Engine & Interaction Architecture

The frontend client implements a high-performance 2D vector canvas referencing the architectural patterns in `docs_archive`:

### 7.1 Procedural Vector Rendering Engine & Rough Aesthetic
- Generates hand-drawn stroke variations dynamically using custom curvature, bowing, and roughness parameters.
- Canvas render pipeline uses off-screen double-buffering for silky-smooth 60 FPS drawing and zooming.
- Renders anchor points, bounding handles, and rotation controls dynamically during selection.

### 7.2 Local-First Optimistic Reconciliation (`reconcileElements`)
- **Optimistic Local Mutations**: When a user drags, resizes, or draws a shape locally, the client immediately updates in-memory scene state, increments `element.version`, regenerates `element.versionNonce`, and sends the op to the backend.
- **Remote Reconciliation Rules**: When a remote element update arrives via STOMP:
  - If local element is actively being edited (`editingTextElement`, `resizingElement`, `newElement`): **Retain local version**.
  - If `local.version > remote.version`: **Retain local version**.
  - If `local.version === remote.version && local.versionNonce <= remote.versionNonce`: **Retain local version** (deterministic tiebreak).
  - Otherwise: **Adopt remote element**.
- **Fractional Indexing for Conflict-Free Z-Ordering**: Canvas elements use string fractional indices (e.g., `"a0"`, `"a1"`, `"a05"`) to preserve consistent visual layering across concurrent insertions without array index shifts.

### 7.3 Presence & Cursor Visualization
- Live collaborator cursors render on a separate dedicated canvas overlay layer.
- Client throttles cursor emission to 30ms (via `requestAnimationFrame` / `throttle`) to conserve network bandwidth.
- Disconnections or tab unloads trigger `USER_LEFT` events and remove collaborator avatars.

### 7.4 Arrow-Binding Anchor Calculations & Labeled Connectors
- Arrows bind dynamically to shapes via `boundElements` references.
- Moving or resizing a shape automatically updates connected arrow endpoints, recalculating boundary intersection tangents and bound text center positions.

### 7.5 Multi-Format Export
- **PNG Blob**: Serializes scene bounding box into high-DPI raster image.
- **SVG Vector**: Generates standards-compliant SVG paths for vector editing.
- **`.graffiti` JSON**: Standardized scene document for full canvas state backups and imports.

### 7.6 Canvas Navigation Minimap Architecture
- **Overview Sub-Canvas**: An interactive 160×100px overview widget positioned in the bottom corner of the viewport (toggleable via `Alt+M`).
- **Real-Time Scene Representation**: Renders simplified bounding box miniatures of all non-deleted canvas shapes, scaled proportionately to the total scene bounding envelope.
- **Draggable Viewport Bounding Box**: An illuminated translucent rectangle indicates the current viewport position and zoom level.
- **Interactive Navigation**:
  - Clicking anywhere inside the minimap instantly centers the canvas viewport on that coordinate.
  - Dragging the viewport rectangle smoothly pans the main canvas in real time.

### 7.7 "Tidy Up" & Auto-Alignment Grid Algorithm
When multiple elements ($N \ge 2$) are selected, clicking "Tidy Up" (`Ctrl+Alt+T`) organizes them into a clean, equidistant layout:
1. **Bounding Box Calculation**: Determines the total bounding rectangle of all selected items and identifies their natural reading order (sorted by top-to-bottom, left-to-right).
2. **Grid / Column / Row Layout Strategy**:
   - If aspect ratio is predominantly horizontal: Arranges in an equidistant horizontal row with uniform gap ($24\text{px}$).
   - If aspect ratio is predominantly vertical: Arranges in an equidistant vertical column with uniform gap ($24\text{px}$).
   - If multi-row cluster: Calculates optimal $M \times K$ grid with standardized cell widths and uniform $24\text{px}$ horizontal and vertical spacing.
3. **Smooth Interpolation & Batch Ops**: Animates shapes smoothly to target coordinates and emits standard `CREATE_OR_UPDATE` CRDT ops for each repositioned element.

### 7.8 Voice-Driven Canvas Commands (Web Speech API)
- **Zero Backend Audio Streaming**: Uses the browser's native `SpeechRecognition` / `webkitSpeechRecognition` API (free client-side speech-to-text built into Chromium, Edge, and Safari).
- **Activation**: Toggle via microphone button in the toolbar or Push-to-Talk shortcut (`M`).
- **Intent Mapping Engine**:
  - **Tool Switching**: *"Select pen"* $\rightarrow$ Tool: `freedraw`, *"Rectangle"* $\rightarrow$ Tool: `rectangle`, *"Sticky note"* $\rightarrow$ Tool: `sticky_note`, *"Eraser"* $\rightarrow$ Tool: `eraser`.
  - **Color Control**: *"Color red"*, *"Background blue"*, *"Fill green"*.
  - **View & Navigation**: *"Zoom to fit"*, *"Reset zoom"*, *"Toggle dark mode"*, *"Show minimap"*.
  - **Canvas Actions**: *"Tidy up"*, *"Clear board"*, *"Export PNG"*, *"Undo"*, *"Redo"*.
- **Visual HUD Toast**: Displays non-intrusive bottom HUD pill showing transcribed phrase and confirmation toast upon execution.

### 7.9 Sticky Note System & Pastel Palette Engine
- **Dedicated Tool (`N`)**: Instantly creates a 200×200px square `rectangle` with `customData: { isStickyNote: true }` and auto-bound centered text.
- **Curated Pastel Palette**:
  - Pastel Yellow: `#fff3bf` (stroke: `#fab005`)
  - Pastel Blue: `#d0ebff` (stroke: `#339af0`)
  - Pastel Green: `#d3f9d8` (stroke: `#51cf66`)
  - Pastel Pink: `#ffdeeb` (stroke: `#f06595`)
  - Pastel Purple: `#f3d9fa` (stroke: `#cc5de8`)
  - Pastel Orange: `#ffe8cc` (stroke: `#ff922b`)
- **Instant Text Focus**: Placing a sticky note immediately opens an inline centered text editor with auto-scaling font size based on text volume.

---

## 8. AI/ML Microservice & Multimodal Intelligence

The AI/ML service runs independently in Python (FastAPI). It interacts asynchronously with the canvas and sync engine, providing intelligent whiteboard capabilities:

```
[User Canvas] ───(Trigger Action / Gesture)───> [AI Microservice] ───(Inference)───┐
      ▲                                                                             │
      │                                                                             ▼
[Render Ghost Overlay] <─────(Broadcast Suggestion) <───── [Spring Boot /internal API]
```

---

### 8.1 Feature 1: Canvas Search with Handwritten Text & Shapes (`Ctrl+F`)
Enables users to search (`Ctrl+F` / `Cmd+F`) across the infinite canvas, matching both typed text elements and **hand-drawn handwriting strokes**.

```
[User draws freedraw strokes] ──> [Background OCR Worker] ──> [Attach customData.ocrText]
                                                                        │
[User searches "Database"] <── [Highlight Matching Bounds] <── [Canvas Search Indexer]
```

1. **Incremental OCR Extraction**:
   - When a user finishes drawing a series of `freedraw` strokes, the client bundles the stroke image/vectors and sends them to the OCR worker.
   - The worker runs lightweight handwriting recognition (e.g., TrOCR, PaddleOCR, or Vision API) and populates `element.customData.ocrText` with the recognized string and confidence score.
2. **Unified Search Index**:
   - The frontend maintains an in-memory spatial search index covering typed `text` shapes, sticky notes, frame labels, and OCR-annotated `freedraw` elements.
3. **Interactive Search UI**:
   - Typing a query highlights all matching element bounding boxes on the canvas with an animated glow.
   - Pressing Enter smoothly pans and zooms the viewport to focus on the next matching handwritten note or shape.

---

### 8.2 Feature 2: Stroke Beautification & Shape Smoothing
Automatically cleans up irregular, shaky hand-drawn shapes into crisp, mathematically smooth geometric primitives or splines while preserving the hand-drawn aesthetic.

```
[Rough Hand-Drawn Stroke] ──> [Douglas-Peucker & Curve Fitting] ──> [Clean Vector Shape]
```

1. **Algorithm Pipeline**:
   - **Point Decimation**: Runs Douglas-Peucker reduction on raw stroke coordinates (`cv2.approxPolyDP` / RDP) to remove jitter.
   - **Geometric Primitive Fitting**: Evaluates convex hull, aspect ratio, circularity, and corner angle variance to detect whether the user intended to draw a:
     - `rectangle` (4 distinct ~90° corners, parallel opposing sides)
     - `ellipse` / `circle` (high circularity, low corner variance)
     - `diamond` (4 corners rotated ~45°)
     - `triangle` (3 prominent vertices)
     - `arrow` (linear stroke terminating in a sharp arrowhead stroke)
   - **Catmull-Rom & Bezier Smoothing**: If the stroke is an irregular curve or custom contour (not a primitive), applies cubic Bezier / Catmull-Rom spline interpolation for silky-smooth contours.
2. **Interaction Modes**:
   - **Auto-Snap on Hold**: Holding the stylus or mouse stationary for 400ms after drawing automatically snaps the stroke into its smoothed shape.
   - **Post-Draw Action**: Tapping a "Beautify Shape" icon replaces selected rough strokes with clean vector primitives.

---

### 8.3 Feature 3: Live Handwritten Math & Equation Solver
Evaluates handwritten mathematical equations and arithmetic directly on the canvas (similar to Apple Math Notes) without disrupting manual drawing:

```
[User writes "45 * 2 + 10 ="] ──> [OCR Math Parser] ──> [SymPy Evaluator] ──> [Place "100" text adjacent]
```

1. **Trigger & Detection**:
   - **Automatic Trigger**: OCR detects a stroke sequence terminating in an equals sign (`=`).
   - **Manual Action**: User selects any handwritten or typed formula and presses `Ctrl+Shift+M` or clicks "Solve Math".
2. **Evaluation Pipeline**:
   - OCR extracts equation string with mathematical symbols (`+`, `-`, `*`, `/`, `^`, `sqrt`, `pi`, `sin`, `cos`, parentheses).
   - Python `sympy` parses and solves the expression in a secure, sandboxed environment (rejecting unsafe expressions).
   - Supports: basic arithmetic (`45 * 12 + 8 =`), percentage calculations, algebra solving (`2x + 10 = 30`), and units.
3. **Canvas Result Placement**:
   - The backend/frontend instantiates a styled `text` element containing the result string (e.g., `"100"`), positioned immediately to the right of the `=` sign at matching font baseline and scale.
   - Tagged with `customData: { mathSolved: true }` and broadcast via standard CRDT ops.

---

### 8.4 Feature 4: "Circle to Ask / Modify / Change" Gesture AI
A gesture-driven multimodal interaction allowing users to circle any region on the canvas to inspect, query, restyle, or transform the enclosed content using an LLM.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 1. User draws a circle/lasso around a group of rough shapes or notes             │
│ 2. System detects the closed loop gesture and highlights enclosed elements       │
│ 3. Contextual AI Action Bar pops up with quick prompts & input field            │
│ 4. AI generates modifications and renders as a non-destructive Ghost Preview     │
│ 5. User accepts (Enter) or dismisses (Esc)                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Gesture Detection**:
   - Detects when a `freedraw` stroke begins and ends near the same point (distance between start and end point < 15% of perimeter) forming a closed bounding loop.
2. **Spatial Context Extraction**:
   - Computes polygon intersection between the drawn circle and all canvas elements.
   - Gathers all enclosed shapes, sticky notes, connectors, typed text, and OCR-extracted handwriting within the circle into a structured scene context payload:
     ```json
     {
       "circleBounds": { "x": 100, "y": 100, "w": 400, "h": 300 },
       "enclosedElements": [
         { "id": "el_1", "type": "rectangle", "text": "Client" },
         { "id": "el_2", "type": "arrow", "from": "el_1", "to": "el_3" },
         { "id": "el_3", "type": "freedraw", "ocrText": "Load Balancer" }
       ],
       "userPrompt": "Refactor this into a clean 3-tier microservices diagram"
     }
     ```
3. **Contextual Action Capabilities**:
   - **Ask & Explain**: Answers questions about the circled architecture, calculations, or notes in an inline popover.
   - **Modify & Restyle**: Standardizes alignment, color-coding, font sizing, or transforms rough notes into a formatted table.
   - **Transform & Expand**: Converts circled rough wireframes into structured UI layouts, or auto-generates error handling branches for a circled flowchart.
4. **Non-Destructive Ghost Overlay**:
   - Proposed replacement shapes appear in translucent `#6965db` ghost styling over the circled region.
   - User reviews the preview and clicks **Accept (Enter)** to commit the change as standard CRDT ops or **Dismiss (Esc)** to keep original strokes.

---

### 8.5 Feature 5: Natural Language Diagram Synthesis (Text-to-Diagram)
Synthesizes full diagrams from textual descriptions (e.g., *"Kubernetes deployment pipeline with CI/CD stages and staging/prod clusters"*):

1. LLM generates structured Mermaid.js or declarative graph syntax.
2. The AI service translates the graph nodes and edges into canvas JSON elements with automated coordinate layout (hierarchical Sugiyama layout).
3. The generated elements are delivered to the canvas as a ghost preview group that can be placed and adjusted anywhere on the board.

---

### 8.6 AI Microservice REST API Contract

| Method | Path | Purpose | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/ocr/extract` | Recognize text from a `freedraw` stroke | `{"roomId": "...", "shapeId": "...", "points": [...], "pressures": [...]}` | `{"shapeId": "...", "ocrText": "...", "confidence": 0.91}` |
| `POST` | `/beautify` | Snap a rough stroke to a clean primitive/spline | `{"roomId": "...", "shapeId": "...", "points": [...]}` | `{"shapeId": "...", "detectedType": "rectangle", "payload": {...cleaned element fields...}}` |
| `POST` | `/math/solve` | Evaluate a mathematical expression | `{"roomId": "...", "equation": "45 * 2 + 10", "anchorPosition": {"x": 200, "y": 150}}` | `{"equation": "45 * 2 + 10", "result": "100", "proposedElement": {...}}` |
| `POST` | `/circle-query` | Handle a "Circle to Ask/Modify/Change" request | `{"roomId": "...", "circleBounds": {...}, "enclosedElements": [...], "userPrompt": "..."}` | `{"action": "restyle" \| "explain" \| "transform", "proposedElements": [...], "explanationText": "..."}` |
| `POST` | `/diagram/synthesize` | Generate a diagram from a text prompt | `{"roomId": "...", "prompt": "...", "anchorPosition": {"x": 0, "y": 0}}` | `{"proposedElements": [...]}` |

All AI endpoints are called **by the backend only**. On success, the backend takes `proposedElements` / `payload`, tags each with `customData.aiGenerated: true`, and forwards them to `POST /internal/rooms/{slug}/ai-suggestion` (§6.1) to be broadcast as ghost-preview ops (§8.7).

### 8.7 Ghost Overlay Accept/Dismiss Wire Format & AI Failure Handling
- **Accept (`Enter`)**: Frontend sends ghost element(s) as a normal `CREATE_OR_UPDATE` op over `/app/rooms/{slug}/op`, merged through the standard CRDT reducer path.
- **Dismiss (`Esc`)**: Frontend discards ghost element(s) locally. No op is sent, nothing is persisted.
- **AI Service Unavailable / Timeout**: 8-second request timeout per call to `graffiti-aiml`. On timeout or error, backend returns graceful non-blocking "AI unavailable" status; core sync engine and user drawings are completely unaffected.

---

## 9. Security, Roles & Session Lifecycle

### 9.1 Authentication Architecture
- **Stateless JWT**: Signed using HMAC-SHA256 (256-bit key). Embeds `userId` (UUID) and `email`.
- **Google OAuth2**: Handled via Spring Security OAuth2 Client. On successful authentication, creates or links a `User` entity and redirects to the frontend with an authorization token.
- **Anonymous Collaboration**: Users can instantly create and participate in public rooms without signing up. Anonymous users are assigned a local session `authorId` (`anon_<uuid>`).

### 9.2 Role-Based Access Control (RBAC)

```
              ┌──────────────────────────────────────────────┐
              │                   Roles                      │
              ├──────────────┬───────────────┬───────────────┤
              │    OWNER     │    EDITOR     │    VIEWER     │
┌─────────────┼──────────────┼───────────────┼───────────────┤
│ View Canvas │      ✓       │       ✓       │       ✓       │
│ Send Presence│     ✓       │       ✓       │       ✓       │
│ Draw/Edit Ops│     ✓       │       ✓       │       ✗       │
│ Run AI Tools │     ✓       │       ✓       │       ✗       │
│ Manage Roles │     ✓       │       ✗       │       ✗       │
│ Delete Room  │     ✓       │       ✗       │       ✗       │
└─────────────┴──────────────┴───────────────┴───────────────┘
```

- **Room Claiming**: An authenticated user can claim ownership of an unowned room via `POST /rooms/{slug}/claim`, becoming its `OWNER`.
- **STOMP Security Interceptor**: `WebSocketSecurityInterceptor` parses JWT tokens from the STOMP `CONNECT` header, binds the user identity to the WebSocket session, and rejects edit frames from `VIEWER` connections.

---

## 10. Conflict & Edge-Case Verification Matrix

| Test Scenario | Trigger Conditions | Expected System Behavior |
| :--- | :--- | :--- |
| **Concurrent Property Edits** | User A moves shape to $(100, 200)$ at $T_1$; User B changes fill color to red at $T_2$ ($T_2 > T_1$). | LWW order wins. State adopts User B's payload. Final state across all replicas is identical. |
| **Identical Lamport Timestamp** | User A ($ID=\text{"alice"}$) and User B ($ID=\text{"bob"}$) submit edits at identical Lamport TS $T=10$. | Tiebreak resolves on author ID: `"bob" > "alice"`. Bob's edit prevails deterministically. |
| **Tombstone vs. Mid-Drag** | User A deletes a shape while User B is dragging it. | Delete op receives higher Lamport TS $T_{\text{del}} > T_{\text{drag}}$. The tombstone persists; shape remains deleted. |
| **Out-of-Order Delivery** | Op 5 arrives before Op 4 over WebSocket. | When Op 4 arrives, $T_4 < T_5$, so Op 4 is safely ignored without overwriting Op 5. |
| **Duplicate Delivery** | Network retry sends identical Op 4 twice. | Idempotent merge reducer processes Op 4 with no state change on the second invocation. |
| **Concurrent Compaction** | Two backend nodes attempt compaction on the same room simultaneously. | Node 1 acquires Redis lock `lock:compact:{roomId}`. Node 2 fails `SET NX` and skips safely. |
| **AI Suggestion Race** | AI proposes shape cleanup, but human moves the shape before accepting. | User's newer manual edit carries a higher Lamport timestamp; stale AI suggestion cannot overwrite. |
| **Network Reconnect** | Client disconnects for 2 minutes and reconnects. | Client fetches `GET /rooms/{slug}`, loads latest snapshot, applies incremental delta ops, and resubscribes. |

---

## 11. Progressive Engineering Roadmap

```
Phase 1: Canvas Core, Layout Tools & Single-Node State Sync
├── [✓] Java 25 & Spring Boot 4.1.0 backend setup with PostgreSQL 16 JSONB schema
├── [✓] STOMP WebSocket message broker (/app/rooms/{slug}/op, /app/rooms/{slug}/presence)
├── [✓] LWW-Element-Set CRDT Merge Service & JUnit 5 test suite
├── [ ] React 19 + TypeScript canvas application (referencing docs_archive/)
├── [ ] Sticky note preset engine (pastel color palette & auto-text binding)
├── [ ] Canvas navigation minimap (sub-canvas rendering & draggable viewport box)
├── [ ] "Tidy Up" auto-alignment grid layout algorithm
├── [ ] Complete keyboard shortcuts engine (Tools, View, Editor actions)
└── [ ] Local-first optimistic reconciliation loop & fractional indexing

Phase 2: Distributed Scalability & Presence
├── [✓] Redis 7 Pub/Sub channel relays (room:{slug}:op, room:{slug}:presence)
├── [✓] Redis distributed locking (SET NX PX) for snapshot compaction
├── [✓] JWT Authentication, Google OAuth2, and room claiming API
├── [ ] Multi-user presence overlay (cursors, selection bounding boxes, avatars)
└── [ ] Local undo/redo stack integrated with remote op streams

Phase 3: Handwriting OCR, Search & Live Math Solver
├── [ ] Python FastAPI microservice setup for asynchronous vision tasks
├── [ ] Background OCR extraction worker for freedraw strokes (populating customData.ocrText)
├── [ ] Unified Canvas Search modal (Ctrl+F) covering text shapes and handwritten strokes
├── [ ] Live Handwritten Math & Equation Solver via SymPy (/math/solve)
└── [ ] Viewport auto-pan and smooth zoom to search results

Phase 4: Stroke Beautification & Voice Commands
├── [ ] Douglas-Peucker point decimation & geometric primitive fitting (rect, ellipse, diamond, arrow)
├── [ ] Catmull-Rom & cubic Bezier curve smoothing for irregular hand-drawn strokes
├── [ ] "Auto-Snap on Hold" stylus/mouse interaction
├── [ ] Browser Web Speech API command parser (tool selection, colors, actions)
└── [ ] One-tap stroke beautification tool in canvas toolbar

Phase 5: Gesture AI & Multimodal Diagram Synthesis
├── [ ] "Circle to Ask / Modify / Change" closed-loop gesture detection
├── [ ] Spatial context extraction (enclosed shapes, sticky notes, text, connectors)
├── [ ] Multimodal LLM integration (Ask, Restyle, Transform, Wireframe-to-Diagram)
├── [ ] Non-destructive Ghost Preview overlay with Accept/Dismiss actions
└── [ ] Stress testing with 100+ concurrent simulated clients per room
```

---

## 12. Environment & Configuration Reference

| Variable | Used By | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `POSTGRES_URL` | Backend | JDBC connection string | `jdbc:postgresql://localhost:5432/graffiti` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Backend, Docker | DB credentials | `graffiti` / `Ankit@1907` |
| `REDIS_HOST` / `REDIS_PORT` | Backend | Redis connection for Pub/Sub + locks | `localhost` / `6379` |
| `JWT_SECRET` | Backend | HMAC-SHA256 signing key (§9.1) | 256-bit secret key string |
| `JWT_EXPIRATION_MS` | Backend | Access token TTL | `86400000` (24h) |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Backend | Google OAuth2 credentials (§9.1) | Google console credentials |
| `APP_COMPACTION_OP_THRESHOLD` | Backend | Ops-since-snapshot count that triggers compaction (§6.3) | `50` |
| `APP_COMPACTION_LOCK_TTL_MS` | Backend | Redis distributed lock TTL for compaction (§6.3) | `30000` |
| `AIML_SERVICE_URL` | Backend | Base URL for `graffiti-aiml` | `http://localhost:8000` |
| `AIML_REQUEST_TIMEOUT_MS` | Backend | Timeout per AI service call (§8.6) | `8000` |
| `PRESENCE_THROTTLE_MS` | Frontend | Cursor emission throttle (§7.3) | `30` |
| `ENABLE_VOICE_COMMANDS` | Frontend | Toggle browser Web Speech recognition | `true` |
| `ENABLE_LIVE_MATH_SOLVER` | AI/ML, Frontend | Toggle automatic math evaluation on `=` | `true` |

---

## 13. Codebase Directory Structure & File Map

```
graffiti/
├── docker/
│   ├── docker-compose.yml          # PostgreSQL 16 & Redis 7 container configuration
│   └── .env                        # Database and Redis environment credentials
├── docs_archive/                   # Reference canvas engine implementation & schemas
│   ├── packages/element/           # Element types, geometric calculations, bounds
│   ├── packages/canvas/            # Canvas rendering, scene reconciliation, math
│   └── collab/                     # Collaborative socket & portal reference
├── graffiti-backend/
│   ├── pom.xml                     # Maven configuration (Java 25, Spring Boot 4.1.0)
│   ├── README.md                   # Backend service documentation
│   └── src/main/java/com/graffiti/
│       ├── crdt/                   # CrdtMergeService, ShapeState (LWW CRDT engine)
│       ├── op/                     # Op entity, OpRequestDTO, OpType, OpRepository, OpService
│       ├── snapshot/               # Snapshot entity, CompactionService, CompactionScheduler
│       ├── room/                   # Room, RoomController, RoomMessageController, RoomService
│       ├── presence/               # PresenceMessageDTO (ephemeral events)
│       ├── redis/                  # RedisConfig, RedisMessagePublisher, RedisMessageSubscriber
│       ├── websocket/              # WebSocketConfig, WebSocketSecurityInterceptor
│       ├── security/               # SecurityConfig, JwtTokenProvider, OAuth2SuccessHandler
│       ├── user/                   # User entity, AuthController, UserService
│       ├── roommember/             # RoomMember entity, Role, RoomMemberService
│       └── ai/                     # AiStubController (internal AI suggestion endpoint)
├── graffiti-frontend/              # React + Canvas UI application (progressive build)
│   └── README.md                   # Frontend architecture & sync loop documentation
├── graffiti-aiml/                  # Python FastAPI AI microservice (progressive build)
│   └── README.md                   # AI/ML service endpoints & pipeline documentation
├── README.md                       # Master repository overview & quickstart guide
└── PROJECT_SPECIFICATION.md        # Master technical blueprint & engineering contract
```
