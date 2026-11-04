from fastapi import APIRouter, HTTPException
from app.simulation.flow_simulator import simulate_flow
from app.schemas.simulation_schema import FlowSimulateRequest, FlowSimulateResponse

router = APIRouter(prefix="/v1/ai/flow", tags=["Simulation"])


@router.post("/simulate", response_model=FlowSimulateResponse)
async def flow_simulate_endpoint(req: FlowSimulateRequest):
    """Smart Spatial Logic & Flow Simulator (Behavioral Execution Engine) powered by Gemini / Groq."""
    try:
        return await simulate_flow(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flow simulation failed: {str(e)}")
