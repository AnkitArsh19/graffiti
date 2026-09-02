from collections import defaultdict, deque
from typing import Dict, List, Tuple
from app.diagram.mermaid_parser import ParsedDiagram, ParsedNode


class NodeLayout(ParsedNode):
    x: float = 0.0
    y: float = 0.0
    width: float = 160.0
    height: float = 70.0


def layout_diagram(
    diagram: ParsedDiagram,
    start_x: float = 100.0,
    start_y: float = 100.0,
    node_w: float = 160.0,
    node_h: float = 70.0,
    gap_x: float = 80.0,
    gap_y: float = 80.0
) -> Dict[str, NodeLayout]:
    if not diagram.nodes:
        return {}

    # Build adjacency and in-degree
    adj = defaultdict(list)
    in_degree = defaultdict(int)
    for node_id in diagram.nodes:
        in_degree[node_id] = 0

    for edge in diagram.edges:
        adj[edge.source].append(edge.target)
        in_degree[edge.target] += 1

    # Topological rank assignment (Sugiyama Layering)
    layers: Dict[int, List[str]] = defaultdict(list)
    node_layer: Dict[str, int] = {}

    # Find root nodes (in_degree == 0)
    roots = [n for n, deg in in_degree.items() if deg == 0]
    if not roots:
        roots = list(diagram.nodes.keys())[:1]

    queue = deque([(r, 0) for r in roots])
    visited = set()

    while queue:
        curr, layer = queue.popleft()
        if curr in visited:
            continue
        visited.add(curr)
        node_layer[curr] = layer

        for neighbor in adj[curr]:
            if neighbor not in visited:
                queue.append((neighbor, layer + 1))

    # Catch any unvisited disconnected components
    current_max_layer = max(node_layer.values()) if node_layer else 0
    for node_id in diagram.nodes:
        if node_id not in node_layer:
            current_max_layer += 1
            node_layer[node_id] = current_max_layer

    for node_id, layer in node_layer.items():
        layers[layer].append(node_id)

    # Assign coordinates based on layout direction
    is_vertical = diagram.direction in ["TD", "TB"]
    layout_result: Dict[str, NodeLayout] = {}

    sorted_layer_indices = sorted(layers.keys())

    for layer_idx in sorted_layer_indices:
        nodes_in_layer = layers[layer_idx]
        num_nodes = len(nodes_in_layer)

        if is_vertical:
            y = start_y + layer_idx * (node_h + gap_y)
            layer_total_width = num_nodes * node_w + (num_nodes - 1) * gap_x
            layer_start_x = start_x - (layer_total_width / 2.0)

            for i, nid in enumerate(nodes_in_layer):
                x = layer_start_x + i * (node_w + gap_x)
                orig = diagram.nodes[nid]
                layout_result[nid] = NodeLayout(
                    id=orig.id,
                    label=orig.label,
                    shape=orig.shape,
                    x=x,
                    y=y,
                    width=node_w,
                    height=node_h
                )
        else:
            # Horizontal (LR)
            x = start_x + layer_idx * (node_w + gap_x)
            layer_total_height = num_nodes * node_h + (num_nodes - 1) * gap_y
            layer_start_y = start_y - (layer_total_height / 2.0)

            for i, nid in enumerate(nodes_in_layer):
                y = layer_start_y + i * (node_h + gap_y)
                orig = diagram.nodes[nid]
                layout_result[nid] = NodeLayout(
                    id=orig.id,
                    label=orig.label,
                    shape=orig.shape,
                    x=x,
                    y=y,
                    width=node_w,
                    height=node_h
                )

    return layout_result
