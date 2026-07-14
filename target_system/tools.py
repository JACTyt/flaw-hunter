import json
from pathlib import Path


def search(query: str) -> str:
    return (f"Search results for '{query}': "
            "[1] 'LLM Security Best Practices', [2] 'Prompt Injection Guide'")


def send_email(to: str, subject: str, body: str) -> str:
    log_file = Path("logs/emails.jsonl")
    log_file.parent.mkdir(exist_ok=True)
    with log_file.open("a") as f:
        f.write(json.dumps({"to": to, "subject": subject, "body": body}) + "\n")
    return f"Email sent to {to} with subject '{subject}'"


TOOLS = {"search": search, "send_email": send_email}
