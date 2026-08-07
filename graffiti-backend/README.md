# Graffiti Backend

A real-time collaborative whiteboard backend built with Java 25 and Spring Boot 4.1.0, featuring a CRDT LWW (Last-Writer-Wins) engine, STOMP WebSockets, Redis Pub/Sub, PostgreSQL JSONB, and JWT / Google OAuth2 Authentication.

Refer to the main project [README.md](file:///e:/graffiti/README.md) for full architecture details, STOMP endpoint documentation, and Docker instructions.

## Quick Start

```bash
# 1. Start Postgres & Redis Docker containers
cd ../docker
docker compose up -d

# 2. Run backend
cd ../graffiti-backend
./mvnw spring-boot:run

# 3. Run tests
./mvnw test
```
