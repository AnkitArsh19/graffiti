import re
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel


class ParsedNode(BaseModel):
    id: str
    label: str
    shape: str  # "rectangle", "ellipse", "diamond"


class ParsedEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None
    style: str = "solid"  # "solid", "dashed", "thick"


class ParsedDiagram(BaseModel):
    direction: str = "TD"  # "TD", "LR", "TB", "RL"
    nodes: Dict[str, ParsedNode] = {}
    edges: List[ParsedEdge] = []


def parse_mermaid(content: str) -> ParsedDiagram:
    diagram = ParsedDiagram()
    lines = content.strip().splitlines()

    node_patterns = [
        # diamond: id{Label}
        (re.compile(r"^([a-zA-Z0-9_]+)\s*\{([^}]+)\}"), "diamond"),
        # rounded / ellipse: id([Label]) or id((Label)) or id(Label)
        (re.compile(r"^([a-zA-Z0-9_]+)\s*\(\[([^\]]+)\]\)"), "ellipse"),
        (re.compile(r"^([a-zA-Z0-9_]+)\s*\(\(([^)]+)\)\)"), "ellipse"),
        (re.compile(r"^([a-zA-Z0-9_]+)\s*\(([^)]+)\)"), "ellipse"),
        # rectangle: id[Label]
        (re.compile(r"^([a-zA-Z0-9_]+)\s*\[([^\]]+)\]"), "rectangle"),
        # plain id
        (re.compile(r"^([a-zA-Z0-9_]+)$"), "rectangle"),
    ]

    # edge regex: NodeA ---|label| NodeB or NodeA -->|label| NodeB
    edge_pattern = re.compile(
        r"([a-zA-Z0-9_]+(?:\s*\[[^\]]+\]|\s*\([^\)]+\)|\s*\{[^\}]+\})?)\s*"
        r"(-->|---|-.->|==>)"
        r"(?:\|([^\|]+)\|)?\s*"
        r"([a-zA-Z0-9_]+(?:\s*\[[^\]]+\]|\s*\([^\)]+\)|\s*\{[^\}]+\})?)"
    )

    def extract_or_add_node(token: str) -> str:
        token = token.strip()
        for pat, shape_type in node_patterns:
            m = pat.match(token)
            if m:
                node_id = m.group(1)
                label = m.group(2) if len(m.groups()) >= 2 else node_id
                if node_id not in diagram.nodes:
                    diagram.nodes[node_id] = ParsedNode(
                        id=node_id,
                        label=label.strip(),
                        shape=shape_type
                    )
                return node_id
        # Fallback simple word
        node_id = token.split()[0] if token else "node"
        if node_id not in diagram.nodes:
            diagram.nodes[node_id] = ParsedNode(
                id=node_id,
                label=token or node_id,
                shape="rectangle"
            )
        return node_id

    for line in lines:
        line = line.strip()
        if not line or line.startswith("%%"):
            continue

        # Header detection: flowchart TD / graph LR
        if line.startswith("graph ") or line.startswith("flowchart "):
            parts = line.split()
            if len(parts) >= 2:
                diagram.direction = parts[1].upper()
            continue

        # Match edges
        edge_match = edge_pattern.search(line)
        if edge_match:
            left_token = edge_match.group(1)
            arrow_type = edge_match.group(2)
            edge_label = edge_match.group(3)
            right_token = edge_match.group(4)

            src_id = extract_or_add_node(left_token)
            tgt_id = extract_or_add_node(right_token)

            style = "dashed" if "-." in arrow_type else ("thick" if "==" in arrow_type else "solid")
            diagram.edges.append(
                ParsedEdge(
                    source=src_id,
                    target=tgt_id,
                    label=edge_label.strip() if edge_label else None,
                    style=style
                )
            )
            continue

        # Check standalone node definition
        for pat, shape_type in node_patterns:
            m = pat.match(line)
            if m:
                node_id = m.group(1)
                label = m.group(2) if len(m.groups()) >= 2 else node_id
                if node_id not in diagram.nodes:
                    diagram.nodes[node_id] = ParsedNode(
                        id=node_id,
                        label=label.strip(),
                        shape=shape_type
                    )
                break

    return diagram
