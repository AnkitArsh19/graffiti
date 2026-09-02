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
