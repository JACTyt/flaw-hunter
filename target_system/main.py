from fastapi import FastAPI
from pydantic import BaseModel
from common.config import settings

app = FastAPI(title="Vulnerable Target Agent")


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(req: ChatRequest):
    from target_system.agent import run_agent
    return run_agent(req.message)


@app.post("/tools/search")
def tool_search(query: str):
    from target_system.tools import search
    return {"result": search(query)}


@app.post("/tools/email")
def tool_email(to: str, subject: str, body: str):
    from target_system.tools import send_email
    return {"result": send_email(to, subject, body)}


@app.get("/config")
def get_config():
    return {"llm_provider": settings.llm_provider,
            "ollama_model": settings.ollama_model,
            "target_url": settings.target_url}
