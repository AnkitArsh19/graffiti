from fastapi import APIRouter
from app.math.sympy_solver import solve_math_expression
from app.schemas.math_schema import AnchorPosition, MathSolveRequest, MathSolveResponse

router = APIRouter(tags=["Math"])


@router.post("/math/solve", response_model=MathSolveResponse)
@router.post("/v1/ai/math/solve", response_model=MathSolveResponse)
async def solve_math(req: MathSolveRequest):
    pos = req.anchorPosition or req.anchor or AnchorPosition(x=100.0, y=100.0)
    result_str, proposed_elem = solve_math_expression(
        req.equation,
        pos.x,
        pos.y,
        variables=req.variables
    )
    return MathSolveResponse(
        equation=req.equation,
        result=result_str,
        proposedElement=proposed_elem
    )
