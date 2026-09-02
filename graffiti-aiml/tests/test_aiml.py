import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UP"


def test_math_solver():
    # 1. Arithmetic
    res = client.post(
        "/math/solve",
        json={
            "equation": "45 * 2 + 10 =",
            "anchorPosition": {"x": 200.0, "y": 150.0}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["result"] == "100"
    assert data["proposedElement"]["type"] == "text"
    assert data["proposedElement"]["customData"]["mathSolved"] is True

    # 2. Algebra
    res2 = client.post(
        "/math/solve",
        json={
            "equation": "2*x + 10 = 30",
            "anchorPosition": {"x": 100.0, "y": 100.0}
        }
    )
    assert res2.status_code == 200
    assert "x = 10" in res2.json()["result"]


def test_beautify():
    # Simulate a rough rectangle
    points = [
        [100.0, 100.0],
        [250.0, 102.0],
        [248.0, 200.0],
        [101.0, 198.0],
        [100.0, 100.0]
    ]
    res = client.post(
        "/beautify",
        json={
            "shapeId": "el_test_1",
            "points": points
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["detectedType"] in ["rectangle", "diamond", "ellipse"]
    assert data["payload"]["customData"]["aiGenerated"] is True


def test_diagram_synthesize():
    res = client.post(
        "/diagram/synthesize",
        json={
            "prompt": "User auth microservice with database",
            "anchorPosition": {"x": 300.0, "y": 200.0}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "flowchart" in data["mermaid"]
    assert len(data["proposedElements"]) > 0
    # Check that elements conform to canvas schema
    sample = data["proposedElements"][0]
    assert "id" in sample
    assert "type" in sample
    assert sample["customData"]["aiGenerated"] is True


def test_text_to_diagram_chat_streaming():
    res = client.post(
        "/v1/ai/text-to-diagram/chat-streaming",
        json={
            "messages": [
                {"role": "user", "content": "CI/CD deployment pipeline"}
            ]
        }
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    content = res.text
    assert "data: " in content
    assert "[DONE]" in content


def test_diagram_to_code_streaming():
    res = client.post(
        "/v1/ai/diagram-to-code/generate-streaming",
        json={
            "texts": ["Login Card", "Email", "Password", "Submit"],
            "theme": "light"
        }
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    content = res.text
    assert "data: " in content
    assert "<!DOCTYPE html>" in content
    assert "[DONE]" in content


def test_ocr_extract():
    res = client.post(
        "/ocr/extract",
        json={
            "shapeId": "el_freedraw_1",
            "points": [[10.0, 10.0], [20.0, 20.0], [30.0, 30.0]]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ocrText"] != ""
    assert data["confidence"] > 0


def test_circle_query():
    res = client.post(
        "/circle-query",
        json={
            "circleBounds": {"x": 100.0, "y": 100.0, "w": 400.0, "h": 300.0},
            "enclosedElements": [
                {"id": "el_1", "type": "rectangle", "text": "Auth Server"}
            ],
            "userPrompt": "Explain this architecture"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["action"] == "explain"
    assert data["explanationText"] is not None


def test_settings_gemini_config():
    from app.config import settings
    assert hasattr(settings, "gemini_api_key")
    assert settings.gemini_model == "gemini-3.8-flash"


def test_math_solver_enhanced():
    # Implicit multiplication: 3x + 5 = 20 -> x = 5
    res = client.post(
        "/math/solve",
        json={
            "equation": "3x + 5 = 20",
            "anchorPosition": {"x": 100.0, "y": 100.0}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "x = 5" in data["result"]
    assert "width" in data["proposedElement"]
    assert "height" in data["proposedElement"]
    assert data["proposedElement"]["width"] > 0
    assert data["proposedElement"]["height"] > 0

    # Power expression: x^2 = 9
    res_pow = client.post(
        "/math/solve",
        json={
            "equation": "x^2 = 9",
            "anchorPosition": {"x": 50.0, "y": 50.0}
        }
    )
    assert res_pow.status_code == 200
    assert res_pow.json()["result"] != "Error"


def test_mermaid_parser_hyphens_and_database_shapes():
    from app.diagram.mermaid_parser import parse_mermaid
    mermaid_code = """flowchart TD
web-client[Web Client] -->|POST /auth/login| api-gateway[API Gateway]
api-gateway -->|Query Credentials| DB[(User DB)]
"""
    parsed = parse_mermaid(mermaid_code)
    assert "web-client" in parsed.nodes
    assert parsed.nodes["web-client"].label == "Web Client"
    assert "api-gateway" in parsed.nodes
    assert parsed.nodes["api-gateway"].label == "API Gateway"
    assert "DB" in parsed.nodes
    # Verify database cylinder shape extracted label without stray parentheses
    assert parsed.nodes["DB"].label == "User DB"
    assert parsed.nodes["DB"].shape == "rectangle"
    assert len(parsed.edges) == 2
    assert parsed.edges[0].source == "web-client"
    assert parsed.edges[0].target == "api-gateway"
    assert parsed.edges[0].label == "POST /auth/login"


def test_element_builder_geometry_and_arrow_labels():
    from app.diagram.mermaid_parser import parse_mermaid
    from app.diagram.layout_engine import layout_diagram
    from app.diagram.element_builder import build_graffiti_elements

    mermaid_code = """flowchart LR
source-node[Source Node] -->|Transfer Data| target-node[Target Node]
"""
    parsed = parse_mermaid(mermaid_code)
    layouts = layout_diagram(parsed, start_x=100.0, start_y=100.0)
    elements = build_graffiti_elements(parsed, layouts)

    # 1. Check all text elements have width and height
    text_elements = [el for el in elements if el["type"] == "text"]
    assert len(text_elements) >= 3  # 2 node labels + 1 arrow label
    for text_el in text_elements:
        assert "width" in text_el and text_el["width"] > 0
        assert "height" in text_el and text_el["height"] > 0

    # 2. Check arrow element and bound label
    arrow_elements = [el for el in elements if el["type"] == "arrow"]
    assert len(arrow_elements) == 1
    arrow = arrow_elements[0]

    # In LR layout, src_cx should connect from right of source to left of target
    src_layout = layouts["source-node"]
    tgt_layout = layouts["target-node"]
    expected_src_cx = src_layout.x + src_layout.width
    expected_tgt_cx = tgt_layout.x
    assert arrow["x"] == expected_src_cx
    assert arrow["points"][1][0] == expected_tgt_cx - expected_src_cx

    # Check arrow label text element
    assert len(arrow["boundElements"]) == 1
    label_id = arrow["boundElements"][0]["id"]
    arrow_label_el = next((el for el in elements if el["id"] == label_id), None)
    assert arrow_label_el is not None
    assert arrow_label_el["text"] == "Transfer Data"
    assert arrow_label_el["containerId"] == arrow["id"]

