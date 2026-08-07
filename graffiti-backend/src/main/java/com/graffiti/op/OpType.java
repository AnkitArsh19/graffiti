package com.graffiti.op;

/**
 * Enumeration representing the structural operation type on a canvas shape.
 *
 * CREATE_OR_UPDATE: Creates a new shape or mutates properties of an existing shape.
 * DELETE: Marks a shape as tombstoned (deleted) in the CRDT engine.
 */
public enum OpType {
    CREATE_OR_UPDATE,
    DELETE
}
