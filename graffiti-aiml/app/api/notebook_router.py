from fastapi import APIRouter, HTTPException
from app.notebook.notebook_summarizer import summarize_notebook
from app.schemas.notebook_schema import NotebookSummarizeRequest, NotebookSummarizeResponse

router = APIRouter(prefix="/v1/ai/notebook", tags=["Notebook"])


@router.post("/summarize", response_model=NotebookSummarizeResponse)
async def notebook_summarize_endpoint(req: NotebookSummarizeRequest):
    """Semantic Notebook Summarizer and Action-Item Extractor powered by Groq API (llama-3.1-8b-instant)."""
    try:
        return await summarize_notebook(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Notebook summarization failed: {str(e)}")
