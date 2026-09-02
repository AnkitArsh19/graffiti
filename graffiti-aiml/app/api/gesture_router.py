from fastapi import APIRouter
from app.gesture.prompt_runner import process_circle_query
from app.schemas.gesture_schema import CircleQueryRequest, CircleQueryResponse

router = APIRouter(tags=["Gesture"])


@router.post("/circle-query", response_model=CircleQueryResponse)
async def handle_circle_query(req: CircleQueryRequest):
    action, proposed, explanation = process_circle_query(
        req.circleBounds.model_dump(),
        req.enclosedElements,
        req.userPrompt
    )
    return CircleQueryResponse(
        action=action,
        proposedElements=proposed,
        explanationText=explanation
    )
