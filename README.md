# Graffiti - Real-Time Collaborative Whiteboard Backend

A high-performance, horizontally scalable real-time collaborative whiteboard backend built with Java 25 and Spring Boot 4.1.0, inspired by Excalidraw's distributed architecture.

Features a CRDT LWW (Last-Writer-Wins) shape merge engine, STOMP WebSockets, Redis Pub/Sub for multi-node event broadcasting, PostgreSQL JSONB storage, Redis distributed-lock snapshot compaction, and JWT / Google OAuth2 Authentication.

---

## Architectural Overview

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

### Key Highlights
1. **LWW-Element-Set CRDT Engine**:
   - Pure, deterministic, commutative, and idempotent state merge reducer.
   - Each shape carries a unique `shape_id`. Edits and tombstones (deletes) are ordered by `(lamport_ts, author_id)`.
2. **Ephemeral Presence vs. Persistent Ops**:
   - High-frequency ephemeral presence (mouse cursors, selection bounds, laser trails) streams directly over Redis Pub/Sub without causing database disk I/O bloat.
   - Structural canvas shape operations (`CREATE_OR_UPDATE`, `DELETE`) are persisted to PostgreSQL and broadcast via Redis.
3. **Snapshot Compaction**:
   - Background worker scans active rooms. When an operation log exceeds N ops since the last snapshot, a Redis distributed lock (`SET NX PX`) ensures a single node compacts the state into a PostgreSQL `JSONB` snapshot.
4. **Flexible Authentication & Role Enforcement**:
   - Supports anonymous room creation, email/password registration & login, and Google OAuth2 Login.
   - Per-room membership roles (`OWNER`, `EDITOR`, `VIEWER`).

---

## Tech Stack

| Component | Technology | Description |
| --- | --- | --- |
| **Language & Runtime** | Java 25 (JDK 25) | Modern Java runtime |
| **Framework** | Spring Boot 4.1.0 | Core backend framework |
| **Real-time Transport** | Spring WebSocket + STOMP + SockJS | WebSockets for multi-user canvas syncing |
| **Pub/Sub & Locking** | Redis 7 | Distributed message relay and lock management |
| **Database** | PostgreSQL 16 | Relational store with native `JSONB` document columns |
| **Security** | Spring Security + JJWT + OAuth2 Client | JWT tokens and Google OAuth2 social login |
| **Containerization** | Docker & Docker Compose | Container orchestration for PostgreSQL & Redis |

---

## Directory & Package Structure

The codebase is organized by Domain Feature Packages under `com.graffiti`:

```
graffiti/
├── docker/
│   └── docker-compose.yml         # Container configuration for PostgreSQL 16 & Redis 7
├── docs_archive/                  # Reference architecture documentation (Excalidraw)
└── graffiti-backend/
    ├── pom.xml                    # Maven configuration (Java 25, Spring Boot 4.1.0)
    └── src/
        ├── main/
        │   ├── java/com/graffiti/
        │   │   ├── security/      # SecurityConfig, JwtTokenProvider, OAuth2SuccessHandler
        │   │   ├── redis/         # RedisConfig, RedisMessagePublisher, RedisMessageSubscriber
        │   │   ├── websocket/     # WebSocketConfig, WebSocketSecurityInterceptor, WebSocketEventListener
        │   │   ├── room/          # Room entity, RoomRepository, RoomService, RoomController, RoomMessageController
        │   │   ├── user/          # User entity, UserRepository, UserService, AuthController
        │   │   ├── roommember/    # RoomMember entity, RoomMemberRepository, RoomMemberService, Role
        │   │   ├── op/            # Op entity (JSONB), OpRepository, OpService, OpType
        │   │   ├── snapshot/      # Snapshot entity (JSONB), SnapshotRepository, CompactionService, CompactionScheduler
        │   │   ├── crdt/          # ShapeState, CrdtMergeService (LWW CRDT Engine)
        │   │   ├── presence/      # PresenceMessageDTO (ephemeral events)
        │   │   └── ai/            # AiStubController (stubbed AI endpoint)
        │   └── resources/
        │       └── application.properties # Environment & datasource properties
        └── test/                  # JUnit 5 & Mockito test suite
```

---

## Getting Started

### Prerequisites
- JDK 25 installed
- Docker Desktop / Docker daemon running

### 1. Start Infrastructure (PostgreSQL & Redis)
Navigate to the `docker/` folder and launch the container stack:

```bash
cd docker
docker compose up -d
```

This starts:
- **PostgreSQL 16**: Port 5432 (User: `graffiti`, Password: `Ankit@1907`, Database: `graffiti`)
- **Redis 7**: Port 6379 (Password: `Ankit@1907`)

### 2. Build and Run Backend
Navigate to `graffiti-backend/` and start the Spring Boot application:

```bash
cd graffiti-backend
./mvnw spring-boot:run
```

The server will start on `http://localhost:8080`.

---

## API Specification

### REST Endpoints

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register user with email and password |
| `POST` | `/auth/login` | Public | Login user and receive JWT bearer token |
| `GET` | `/oauth2/authorization/google` | Public | Initiate Google OAuth2 login flow |
| `POST` | `/rooms` | Public / Auth | Create a new room (returns 8-character unique slug) |
| `GET` | `/rooms/{slug}` | Public | Get room metadata + latest snapshot + ops since snapshot |
| `POST` | `/rooms/{slug}/claim` | Authenticated | Claim ownership of an anonymous room |
| `POST` | `/internal/rooms/{slug}/ai-suggestion` | Public | Stubbed AI suggestion endpoint |

---

### WebSocket / STOMP Transport

- **STOMP Endpoint**: `ws://localhost:8080/ws` (supports SockJS fallback)
- **Subscribe Destination**: `/topic/rooms/{slug}`
- **Message Mapping Endpoints**:
  - `SEND /app/rooms/{slug}/op`: Send a shape create/update/delete operation.
  - `SEND /app/rooms/{slug}/presence`: Send an ephemeral cursor position or user presence event.

---

## Testing

Run the full automated JUnit 5 test suite (using H2 in-memory DB and mock Redis beans):

```bash
cd graffiti-backend
./mvnw test
```

### Verified Tests
- `CrdtMergeServiceTest`: Verifies commutative order invariance, idempotency, and Lamport timestamp tie-breaking.
- `CompactionServiceTest`: Verifies snapshot generation when op count exceeds threshold (N=50).
- `RoomControllerTest`: Verifies anonymous room creation, metadata retrieval, user registration, and room claiming.
