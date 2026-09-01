# Graffiti Backend — Real-Time Sync & CRDT Engine

The core backend service for Graffiti, built with **Java 25 (JDK 25)** and **Spring Boot 4.1.0**. It owns room management, STOMP WebSocket communication, PostgreSQL persistence with native JSONB columns, Redis 7 Pub/Sub event broadcasting, distributed lock snapshot compaction, and Last-Writer-Wins (LWW) CRDT state merging.

---

## Architectural Highlights

```
                               ┌───────────────────────────┐
                               │   WebSocket / STOMP Client│
                               └─────────────┬─────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │  Spring Boot Node (WebSocket Controller)  │
                       └──────────┬─────────────────────┬──────────┘
                                  │                     │
                     Ephemeral    │                     │ Structural
                     Presence     │                     │ Ops
                                  │                     ▼
                                  │             ┌──────────────┐
                                  │             │ PostgreSQL 16│
                                  │             │ (Op / JSONB) │
                                  │             └──────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │    Redis 7 Pub/Sub & Lock    │
                   │ (room:{slug}:op / presence)  │
                   └──────────────┬───────────────┘
                                  │
                       ┌──────────┴──────────┐
                       │  Subscribed Nodes   │
                       └─────────────────────┘
```

1. **LWW-Element-Set CRDT Engine (`CrdtMergeService`)**:
   - Pure, deterministic, commutative, and idempotent state merge reducer.
   - Operations are ordered by `(lamportTs, authorId)` tuples with deterministic string tie-breaking.
   - Deletions are tombstones (`OpType.DELETE`, `deleted: true`) to prevent stale edits from resurrecting deleted shapes.
2. **Segregated Channel Architecture**:
   - High-throughput ephemeral presence (`cursor`, `laser`, `selection`) streams across Redis Pub/Sub directly to subscribers at `/topic/rooms/{slug}` without writing to disk.
   - Low-frequency structural canvas shape mutations (`CREATE_OR_UPDATE`, `DELETE`) are persisted into PostgreSQL `ops` table with JSONB payloads and broadcast via Redis.
3. **Snapshot Compaction with Redis Distributed Locks (`CompactionService`)**:
   - Background worker monitors active rooms. When an op log exceeds $N$ ops (`app.compaction.op-threshold=50`), a Redis distributed lock (`SET lock:compact:{roomId} {uuid} NX PX 30000`) guarantees a single node compacts the state into a consolidated JSONB snapshot.
4. **Flexible Authentication & Role Enforcement**:
   - Supports anonymous frictionless room creation, email/password registration & login, and Google OAuth2 Login.
   - Role-based permissions: `OWNER` (full admin/claim), `EDITOR` (draw/edit shapes), `VIEWER` (read-only canvas).
   - STOMP handshake security interceptor (`WebSocketSecurityInterceptor`) validating JWT tokens.

---

## Tech Stack

| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Language & Runtime** | Java (JDK) | 25 | Modern Java LTS runtime |
| **Framework** | Spring Boot | 4.1.0 | Web, Security, WebSocket, Data JPA, Data Redis |
| **Real-Time Transport** | Spring WebSocket + STOMP | 4.1.0 | Full-duplex messaging with SockJS fallback |
| **Pub/Sub & Locking** | Redis | 7.x | Distributed message relay and lock management |
| **Database** | PostgreSQL | 16.x | Relational store with native `JSONB` document columns |
| **Security** | Spring Security + JJWT + OAuth2 | 0.12.6 | Stateless JWT and Google OAuth2 social login |

---

## Directory & Package Structure

```
graffiti-backend/
├── pom.xml                         # Maven configuration (Java 25, Spring Boot 4.1.0)
└── src/
    ├── main/
    │   ├── java/com/graffiti/
    │   │   ├── crdt/               # CrdtMergeService, ShapeState (LWW CRDT Engine)
    │   │   ├── op/                 # Op entity (JSONB), OpRequestDTO, OpType, OpRepository, OpService
    │   │   ├── snapshot/           # Snapshot entity (JSONB), CompactionService, CompactionScheduler
    │   │   ├── room/               # Room, RoomController, RoomMessageController, RoomService
    │   │   ├── presence/           # PresenceMessageDTO (ephemeral events)
    │   │   ├── redis/              # RedisConfig, RedisMessagePublisher, RedisMessageSubscriber
    │   │   ├── websocket/          # WebSocketConfig, WebSocketSecurityInterceptor, WebSocketEventListener
    │   │   ├── security/           # SecurityConfig, JwtTokenProvider, OAuth2SuccessHandler
    │   │   ├── user/               # User, AuthController, UserService, UserRepository
    │   │   ├── roommember/         # RoomMember, Role, RoomMemberService, RoomMemberRepository
    │   │   └── ai/                 # AiStubController (internal AI suggestion callback endpoint)
    │   └── resources/
    │       └── application.properties # Datasource, Redis, OAuth2 & compaction properties
    └── test/                       # Comprehensive JUnit 5 & Mockito test suite
```

---

## REST API Specification

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register user with email, password, and name |
| `POST` | `/auth/login` | Public | Login and receive JWT bearer token |
| `GET` | `/oauth2/authorization/google` | Public | Initiate Google OAuth2 login flow |
| `POST` | `/rooms` | Optional | Create a new whiteboard room (returns 8-character slug) |
| `GET` | `/rooms/{slug}` | Public | Rehydrate room (latest snapshot + ops executed since snapshot) |
| `POST` | `/rooms/{slug}/claim` | Required | Claim ownership of an unowned room |
| `POST` | `/internal/rooms/{slug}/ai-suggestion` | Internal | Ingest proposed operations from AI service |

---

## WebSocket / STOMP Transport

- **Endpoint**: `ws://localhost:8080/ws` (with SockJS fallback at `http://localhost:8080/ws`)
- **Subscribe Destination**: `/topic/rooms/{slug}`
- **Message Mapping Endpoints**:
  - `SEND /app/rooms/{slug}/op`: Send a shape create/update/delete operation.
  - `SEND /app/rooms/{slug}/presence`: Send an ephemeral cursor position or selection event.

---

## Getting Started

### Prerequisites
- JDK 25 installed
- Docker & Docker Compose running (for PostgreSQL 16 & Redis 7)

### 1. Launch Infrastructure Containers
```bash
cd ../docker
docker compose up -d
```

### 2. Build & Run Backend
```bash
cd ../graffiti-backend
./mvnw spring-boot:run
```
The server starts on `http://localhost:8080`.

### 3. Run Automated Tests
```bash
./mvnw test
```
All unit and integration tests (including CRDT order-invariance, compaction logic, and room security) run against an in-memory H2 database with mock Redis templates.
