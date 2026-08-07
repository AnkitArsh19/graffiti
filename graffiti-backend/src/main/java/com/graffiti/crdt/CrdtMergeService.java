package com.graffiti.crdt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.graffiti.op.Op;
import com.graffiti.op.OpType;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service providing CRDT (Conflict-Free Replicated Data Type) shape state merge logic.
 *
 * Implements a Last-Writer-Wins Element-Set (LWW-Element-Set) reducer for canvas shapes.
 * 
 * Key Properties:
 * 1. Commutative: Merging operations produces the exact same final state regardless of the order of execution.
 * 2. Idempotent: Applying duplicate operations does not alter the resulting state.
 * 3. Deterministic Tie-breaking: When two operations carry identical Lamport timestamps, ties are broken
 *    by lexicographically comparing author IDs.
 * 4. Tombstones: Shape deletions mark isDeleted = true rather than hard-deleting the record, ensuring late-arriving
 *    edits with lower timestamps cannot resurrect deleted elements.
 */
@Service
public class CrdtMergeService {

    private final ObjectMapper objectMapper;

    public CrdtMergeService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Reduces an un-ordered stream or collection of shape operations into a map of Shape ID -> ShapeState.
     *
     * @param ops Collection of shape operations to merge
     * @return Map mapping shapeId to its current resolved ShapeState
     */
    public Map<String, ShapeState> mergeOps(Collection<Op> ops) {
        Map<String, ShapeState> stateMap = new HashMap<>();
        if (ops == null || ops.isEmpty()) {
            return stateMap;
        }

        for (Op op : ops) {
            applyOp(stateMap, op);
        }
        return stateMap;
    }

    /**
     * Applies a single incoming operation to an existing ShapeState map according to LWW rules.
     *
     * Rules:
     * - If no shape state exists for shapeId: apply operation.
     * - If op.lamportTs > existing.lamportTs: apply operation.
     * - If op.lamportTs == existing.lamportTs: apply if op.authorId > existing.authorId.
     * - Otherwise: ignore operation.
     *
     * @param stateMap The target state map to update
     * @param op The incoming operation
     */
    public void applyOp(Map<String, ShapeState> stateMap, Op op) {
        String shapeId = op.getShapeId();
        ShapeState current = stateMap.get(shapeId);

        boolean shouldApply = false;
        if (current == null) {
            shouldApply = true;
        } else {
            int timeCompare = op.getLamportTs().compareTo(current.getLamportTs());
            if (timeCompare > 0) {
                shouldApply = true;
            } else if (timeCompare == 0) {
                // Lexicographical tiebreak on authorId string when Lamport timestamps match
                int authorCompare = op.getAuthorId().compareTo(current.getAuthorId());
                if (authorCompare > 0) {
                    shouldApply = true;
                }
            }
        }

        if (shouldApply) {
            boolean isDeleted = (op.getOpType() == OpType.DELETE);
            ShapeState newState = new ShapeState(
                    shapeId,
                    op.getPayload(),
                    op.getLamportTs(),
                    op.getAuthorId(),
                    isDeleted
            );
            stateMap.put(shapeId, newState);
        }
    }

    /**
     * Merges a stream of new operations on top of a base snapshot state JSON node.
     *
     * @param baseSnapshotState Pre-existing consolidated snapshot JSON state
     * @param newOps Incremental operations executed since the snapshot
     * @return Consolidated JSON state incorporating all operations
     */
    public JsonNode mergeOpsOnSnapshot(JsonNode baseSnapshotState, Collection<Op> newOps) {
        Map<String, ShapeState> stateMap = parseSnapshotState(baseSnapshotState);
        if (newOps != null) {
            for (Op op : newOps) {
                applyOp(stateMap, op);
            }
        }
        return serializeStateMap(stateMap);
    }

    /**
     * Converts a JsonNode snapshot object into a Map of Shape ID -> ShapeState.
     *
     * @param snapshotNode The JSON node stored in Snapshot entity
     * @return Converted ShapeState map
     */
    public Map<String, ShapeState> parseSnapshotState(JsonNode snapshotNode) {
        Map<String, ShapeState> stateMap = new HashMap<>();
        if (snapshotNode == null || !snapshotNode.isObject()) {
            return stateMap;
        }

        snapshotNode.fields().forEachRemaining(entry -> {
            String shapeId = entry.getKey();
            JsonNode shapeNode = entry.getValue();
            try {
                ShapeState shapeState = objectMapper.treeToValue(shapeNode, ShapeState.class);
                stateMap.put(shapeId, shapeState);
            } catch (Exception e) {
                // Ignore unparseable elements if schema invalid
            }
        });
        return stateMap;
    }

    /**
     * Serializes a Map of Shape ID -> ShapeState into a consolidated JsonNode for snapshot storage.
     *
     * @param stateMap Target map of shape states
     * @return ObjectNode representing room canvas state
     */
    public JsonNode serializeStateMap(Map<String, ShapeState> stateMap) {
        ObjectNode root = objectMapper.createObjectNode();
        if (stateMap != null) {
            stateMap.forEach((shapeId, shapeState) -> {
                root.set(shapeId, objectMapper.valueToTree(shapeState));
            });
        }
        return root;
    }
}
