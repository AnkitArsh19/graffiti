from fastapi import APIRouter
from app.math.sympy_solver import solve_math_expression
from app.schemas.math_schema import MathSolveRequest, MathSolveResponse

router = APIRouter(tags=["Math"])


@router.post("/math/solve", response_model=MathSolveResponse)
async def solve_math(req: MathSolveRequest):
    result_str, proposed_elem = solve_math_expression(
        req.equation,
        req.anchorPosition.x,
        req.anchorPosition.y
    )
    return MathSolveResponse(
        equation=req.equation,
        result=result_str,
        proposedElement=proposed_elem
    )
