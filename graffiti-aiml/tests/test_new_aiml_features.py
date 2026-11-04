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
    # Root node should be identified and centered
    root_node = next(n for n in data["nodes"] if n["id"] == data["rootNodeId"])
    assert root_node["id"] == "node_1"
    
    # Verify symmetrical bidirectional placement (children on both right and left)
    right_nodes = [n for n in data["nodes"] if n["id"] != root_node["id"] and n["x"] > root_node["x"]]
    left_nodes = [n for n in data["nodes"] if n["id"] != root_node["id"] and n["x"] < root_node["x"]]
    assert len(right_nodes) >= 1
    assert len(left_nodes) >= 1

    # Mindmap must generate connector lines
    assert len(data["connectors"]) >= 3
    # Verify connectors have valid arrow element properties and curved styling
    for conn in data["connectors"]:
        assert conn["type"] == "arrow"
        assert conn["arrowType"] == "curved"
        assert "startBinding" in conn
        assert "endBinding" in conn
        assert len(conn["points"]) >= 2


def test_mindmap_root_priority_ai_over_nlp():
    """Verify semantic parent topics like 'Artificial Intelligence' override short sub-topics/acronyms like 'NLP'."""
    elements = [
        {"id": "node_nlp", "text": "NLP", "type": "sticky", "x": 100, "y": 100, "width": 120, "height": 60},
        {"id": "node_ai", "text": "Artificial Intelligence", "type": "rectangle", "x": 500, "y": 200, "width": 200, "height": 80},
        {"id": "node_cv", "text": "Computer Vision", "type": "sticky", "x": 200, "y": 400, "width": 160, "height": 70},
        {"id": "node_rl", "text": "Reinforcement Learning", "type": "rectangle", "x": 600, "y": 450, "width": 180, "height": 70},
    ]

    res = client.post(
        "/v1/ai/mindmap/auto-layout",
        json={
            "elements": elements,
            "anchorX": 500.0,
            "anchorY": 300.0,
            "preferredModel": "auto"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # 'Artificial Intelligence' must be the central root, NOT 'NLP'
    assert data["rootNodeId"] == "node_ai"

    root_node = next(n for n in data["nodes"] if n["id"] == "node_ai")
    assert root_node["text"] == "Artificial Intelligence"
    # Root node must be locked at exact center
    expected_root_x = 500.0 - (float(root_node["width"]) / 2.0)
    expected_root_y = 300.0 - (float(root_node["height"]) / 2.0)
    assert abs(root_node["x"] - expected_root_x) < 0.01
    assert abs(root_node["y"] - expected_root_y) < 0.01

    # Symmetrical distribution: child branches on both right and left
    right_nodes = [n for n in data["nodes"] if n["id"] != "node_ai" and n["x"] > root_node["x"]]
    left_nodes = [n for n in data["nodes"] if n["id"] != "node_ai" and n["x"] < root_node["x"]]
    assert len(right_nodes) >= 1
    assert len(left_nodes) >= 1



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


def test_flow_simulator_spatial_proximity_floating_text():
    """Verify floating text labels near shape borders are correctly associated, preventing blank traces."""
    elements = [
        # Start node (ellipse)
        {"id": "n1", "type": "ellipse", "text": "Start", "x": 100, "y": 100, "width": 100, "height": 50},
        # Shape without text, but floating text label near its border
        {"id": "n2", "type": "rectangle", "text": "", "x": 260, "y": 95, "width": 160, "height": 60},
        {"id": "t2", "type": "text", "text": "Validate Auth Token", "x": 275, "y": 110, "width": 130, "height": 30},
        # Decision diamond without text, but floating text label inside
        {"id": "n3", "type": "diamond", "text": "", "x": 480, "y": 90, "width": 120, "height": 70},
        {"id": "t3", "type": "text", "text": "Is Valid?", "x": 495, "y": 110, "width": 90, "height": 30},
        # End node
        {"id": "n4", "type": "rectangle", "text": "Dashboard", "x": 660, "y": 95, "width": 160, "height": 60},
        # Connecting arrows
        {"id": "a1", "type": "arrow", "x": 200, "y": 125, "startBinding": {"elementId": "n1"}, "endBinding": {"elementId": "n2"}},
        {"id": "a2", "type": "arrow", "x": 420, "y": 125, "startBinding": {"elementId": "n2"}, "endBinding": {"elementId": "n3"}},
        {"id": "a3", "type": "arrow", "x": 600, "y": 125, "startBinding": {"elementId": "n3"}, "endBinding": {"elementId": "n4"}},
        # Floating branch text near arrow a3 midpoint
        {"id": "t_branch", "type": "text", "text": "Yes", "x": 625, "y": 115, "width": 40, "height": 20},
    ]

    res = client.post(
        "/v1/ai/flow/simulate",
        json={
            "elements": elements,
            "initialInputs": {"userId": "usr_777"}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    # Check graphNodes: n2 and n3 should have acquired the floating text labels
    node_map = {n["id"]: n for n in data["graphNodes"]}
    assert "Validate Auth Token" in node_map["n2"]["label"]
    assert "Is Valid?" in node_map["n3"]["label"]
    assert node_map["n3"]["nodeType"] == "decision"

    # Floating text elements should NOT be separate orphaned nodes
    assert "t2" not in node_map
    assert "t3" not in node_map
    assert "t_branch" not in node_map

    # Check execution steps have no blank logs and contain the associated text labels
    for step in data["executionSteps"]:
        assert step["log"] != ""
        assert "Data entered node ''" not in step["log"]
    
    logs_combined = " ".join(step["log"] for step in data["executionSteps"])
    assert "Validate Auth Token" in logs_combined



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
    # Must return a summary string for speech synthesis playback
    assert "summary" in data
    assert isinstance(data["summary"], str)
    assert len(data["summary"]) > 0


def test_flow_simulator_aabb_100px_threshold():
    """Shape with no text but floating label within 100px (not 60px) must acquire that label."""
    elements = [
        # Start ellipse
        {"id": "n1", "type": "ellipse", "text": "Start", "x": 100, "y": 100, "width": 100, "height": 50},
        # Rectangle with no text; floating label is 70px away from its border — within 100px but beyond 60px.
        {"id": "n2", "type": "rectangle", "text": "", "x": 300, "y": 100, "width": 150, "height": 60},
        # text centroid at (540, 130): right border of n2 is at x=450, so gap = 540 - 110/2 - 450 = 85px > 60px
        {"id": "t2", "type": "text", "text": "Process Payload", "x": 485, "y": 115, "width": 110, "height": 30},
        # End rectangle
        {"id": "n3", "type": "rectangle", "text": "Done", "x": 700, "y": 100, "width": 120, "height": 60},
        # Connecting arrows
        {"id": "a1", "type": "arrow", "x": 200, "y": 125, "startBinding": {"elementId": "n1"}, "endBinding": {"elementId": "n2"}},
        {"id": "a2", "type": "arrow", "x": 450, "y": 125, "startBinding": {"elementId": "n2"}, "endBinding": {"elementId": "n3"}},
    ]

    res = client.post(
        "/v1/ai/flow/simulate",
        json={"elements": elements, "initialInputs": {}}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

    node_map = {n["id"]: n for n in data["graphNodes"]}
    # n2 must have acquired 'Process Payload' via the 100px AABB threshold
    assert "Process Payload" in node_map["n2"]["label"]
    # Floating text t2 should NOT be an orphaned node
    assert "t2" not in node_map


def test_flow_simulator_step_n_default_labels():
    """Shapes with no text and no nearby text must receive sequential 'Step N' labels, not discarded."""
    elements = [
        # Three bare shapes with no text, no nearby text nodes
        {"id": "s1", "type": "rectangle", "text": "", "x": 100, "y": 100, "width": 150, "height": 60},
        {"id": "s2", "type": "rectangle", "text": "", "x": 320, "y": 100, "width": 150, "height": 60},
        {"id": "s3", "type": "rectangle", "text": "", "x": 540, "y": 100, "width": 150, "height": 60},
        {"id": "a1", "type": "arrow", "x": 250, "y": 130, "startBinding": {"elementId": "s1"}, "endBinding": {"elementId": "s2"}},
        {"id": "a2", "type": "arrow", "x": 470, "y": 130, "startBinding": {"elementId": "s2"}, "endBinding": {"elementId": "s3"}},
    ]

    res = client.post(
        "/v1/ai/flow/simulate",
        json={"elements": elements, "initialInputs": {}}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # All 3 shapes should be present as nodes with sequential "Step N" labels
    assert len(data["graphNodes"]) == 3
    labels = [n["label"] for n in data["graphNodes"]]
    assert any("Step 1" in lbl for lbl in labels)
    assert any("Step 2" in lbl for lbl in labels)
    assert any("Step 3" in lbl for lbl in labels)
    # Execution trace must not be empty
    assert len(data["executionSteps"]) >= 1
