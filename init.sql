-- Graffiti Whiteboard Master Database Schema
-- Compatible with PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 2. Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces (owner_id);

-- 3. Folders Table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(32) DEFAULT '#4dabf7',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_workspace_parent ON folders (workspace_id, parent_folder_id);

-- 4. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT 'Untitled Board',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_slug ON rooms (slug);
CREATE INDEX IF NOT EXISTS idx_rooms_folder ON rooms (folder_id);
CREATE INDEX IF NOT EXISTS idx_rooms_workspace ON rooms (workspace_id);

-- 5. Room Members Table (RBAC: OWNER, EDITOR, VIEWER)
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    CONSTRAINT uk_room_user UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members (room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members (user_id);

-- 6. Notebook Pages Table
CREATE TABLE IF NOT EXISTS pages (
    id VARCHAR(64) PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    template VARCHAR(32) NOT NULL DEFAULT 'blank',
    page_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_room ON pages (room_id);

-- 7. Persistent Operations Log Table (Append-Only LWW CRDT)
CREATE TABLE IF NOT EXISTS ops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    shape_id VARCHAR(255) NOT NULL,
    op_type VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL,
    lamport_ts BIGINT NOT NULL,
    author_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_room_lamport ON ops (room_id, lamport_ts ASC);

-- 8. Snapshots Table (Consolidated Canvas State)
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    pages JSONB NOT NULL DEFAULT '[]',
    up_to_lamport_ts BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_room_lamport ON snapshots (room_id, up_to_lamport_ts DESC);
