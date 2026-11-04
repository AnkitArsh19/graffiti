import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_mindmap_auto_layout():
    elements = [
        {"id": "node_1", "text": "Cloud Architecture", "type": "sticky", "x": 100, "y": 100, "width": 180, "height": 80},
        {"id": "node_2", "text": "Kubernetes Cluster", "type": "rectangle", "x": 500, "y": 80, "width": 160, "height": 70},
        {"id": "node_3", "text": "PostgreSQL DB", "type": "rectangle", "x": 200, "y": 400, "width": 160, "height": 70},
        {"id": "node_4", "text": "Redis Cache", "type": "sticky", "x": 600, "y": 450, "width": 150, "height": 70},
    ]

    res = client.post(
        "/v1/ai/mindmap/auto-layout",
        json={
            "elements": elements,
            "anchorX": 400.0,
            "anchorY": 300.0,
            "preferredModel": "auto"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["nodes"]) == 4
    # Mindmap must generate connector lines
    assert len(data["connectors"]) >= 3
    # Verify connectors have valid arrow element properties
    for conn in data["connectors"]:
        assert conn["type"] == "arrow"
        assert "startBinding" in conn
        assert "endBinding" in conn
        assert "points" in conn


def test_flowchart_to_code():
    # Simple 1x1 white PNG as dummy test canvas capture
    dummy_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

    res = client.post(
        "/v1/ai/flowchart/to-code",
        json={
            "image": dummy_b64,
            "targetLanguage": "both"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "class " in data["pythonCode"] or "def " in data["pythonCode"]
    assert "class " in data["nodeJsCode"] or "function " in data["nodeJsCode"]
    assert "flowchart" in data["mermaid"]
    assert len(data["detectedNodes"]) > 0


def test_notebook_summarize():
    sample_text = """
    # Sprint Architecture Review
    We decided to use PostgreSQL for relational persistence and Redis for token caching.
    Action: @Alice to provision AWS Aurora cluster by Friday.
    TODO: @Bob set up Redis replication.
    Open Question: What is the maximum spike throughput expected during Black Friday?
    """

    res = client.post(
        "/v1/ai/notebook/summarize",
        json={
            "text": sample_text,
            "pageTitle": "Sprint Planning"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["executiveSummary"]) > 0
    assert len(data["actionItems"]) >= 1
    assert len(data["keyDecisions"]) >= 1
    assert len(data["openQuestions"]) >= 1


def test_theme_morph():
    elements = [
        {
            "id": "box_1",
            "type": "rectangle",
            "strokeColor": "#000000",
            "backgroundColor": "#ffffff",
            "strokeWidth": 1.0,
            "roughness": 1.0,
            "fontFamily": "clean",
            "x": 120.0,
            "y": 140.0,
            "width": 150.0,
            "height": 70.0,
            "text": "Auth Service"
        },
        {
            "id": "arrow_1",
            "type": "arrow",
            "strokeColor": "#000000",
            "x": 270.0,
            "y": 175.0,
            "width": 100.0,
            "height": 0.0,
            "points": [{"x": 0.0, "y": 0.0}, {"x": 100.0, "y": 0.0}]
        }
    ]

    res = client.post(
        "/v1/ai/theme/morph",
        json={
            "themePrompt": "Cyberpunk Blueprint",
            "elements": elements
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["themeName"] == "Cyberpunk Blueprint"
    assert len(data["updatedElements"]) == 2

    # CRITICAL: Verify spatial coordinates are strictly preserved
    updated_box = next(e for e in data["updatedElements"] if e["id"] == "box_1")
    assert updated_box["x"] == 120.0
    assert updated_box["y"] == 140.0
    assert updated_box["width"] == 150.0
    assert updated_box["height"] == 70.0

    # Verify aesthetic morphing happened
    assert updated_box["strokeColor"] != "#000000"


def test_flow_simulator():
    elements = [
        {"id": "n1", "type": "ellipse", "text": "Start", "x": 100, "y": 100, "width": 100, "height": 50},
        {"id": "n2", "type": "rectangle", "text": "Validate Auth Token", "x": 260, "y": 95, "width": 160, "height": 60},
        {"id": "n3", "type": "diamond", "text": "Is Valid?", "x": 480, "y": 90, "width": 120, "height": 70},
        {"id": "n4", "type": "rectangle", "text": "Proceed to Dashboard", "x": 660, "y": 95, "width": 160, "height": 60},
        {"id": "a1", "type": "arrow", "x": 200, "y": 125, "startBinding": {"elementId": "n1"}, "endBinding": {"elementId": "n2"}},
        {"id": "a2", "type": "arrow", "x": 420, "y": 125, "startBinding": {"elementId": "n2"}, "endBinding": {"elementId": "n3"}},
        {"id": "a3", "type": "arrow", "text": "Yes", "x": 600, "y": 125, "startBinding": {"elementId": "n3"}, "endBinding": {"elementId": "n4"}},
    ]

    res = client.post(
        "/v1/ai/flow/simulate",
        json={
            "elements": elements,
            "initialInputs": {"userId": "usr_99", "role": "admin"}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["executionSteps"]) >= 2
    # Verify execution step properties
    for step in data["executionSteps"]:
        assert "stepIndex" in step
        assert "activeNodeId" in step
        assert "log" in step
        assert "stateVariables" in step


def test_voice_storyboard():
    res = client.post(
        "/v1/ai/voice/storyboard",
        json={
            "transcript": "Let's create an API Gateway that calls an Auth Service and writes to Postgres Database",
            "anchorPosition": {"x": 300.0, "y": 200.0}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["newElements"]) > 0
    # Must have both nodes and arrows
    has_card = any(e.get("type") in ["card", "rectangle"] for e in data["newElements"])
    assert has_card is True
