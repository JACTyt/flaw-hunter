# Flaw Hunter

An autonomous LLM red-team tool that attacks a deliberately vulnerable AI agent, discovers exploits, and generates structured security reports.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Flaw Hunter                         │
│                                                         │
│  ┌─────────────────┐        ┌─────────────────────┐    │
│  │  Attacker        │ HTTP  │  Target System       │    │
│  │  :8000           │──────▶│  :8001               │    │
│  │                  │       │                      │    │
│  │  FastAPI API     │       │  FastAPI API          │    │
│  │  Campaign CRUD   │       │  Vulnerable LLM      │    │
│  │  WebSocket stream│       │  Agent (no guardrails)│    │
│  │  SQLite DB       │       │  Tools: search, email │    │
│  └─────────────────┘       └─────────────────────┘    │
│                                                         │
│  ┌─────────────────┐                                    │
│  │  Frontend        │                                    │
│  │  React + Vite    │                                    │
│  │  :5173 (dev)     │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

**Attack pipeline per round:** recon → generate payload → execute → analyze (LLM) → refine if failed → store → emit WebSocket event

**LLM providers:** Claude (Anthropic API) or Ollama (local models)

---

## Requirements

- Python 3.11+
- Node.js 18+ (frontend only)
- Docker + Docker Compose (for containerized deployment)
- An Anthropic API key **or** a running [Ollama](https://ollama.com) instance

---

## Quick Start (Manual)

### 1. Clone and configure

```bash
git clone https://github.com/dmaistruk/flaw-hunter.git
cd flaw-hunter
cp .env.example .env   # then edit .env with your settings
```

Minimum `.env` for Claude:

```env
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

Minimum `.env` for Ollama:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### 2. Install Python dependencies

```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 3. Start the target system

```bash
uvicorn target_system.main:app --host 0.0.0.0 --port 8001
```

The target exposes a deliberately vulnerable LLM agent at `http://localhost:8001`.

### 4. Start the attacker service

In a new terminal (same venv activated):

```bash
uvicorn attacker.main:app --host 0.0.0.0 --port 8000
```

The attacker API is now available at `http://localhost:8000`.

### 5. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### 6. Run a campaign

Using the UI:

1. Navigate to **Campaigns** → **New Campaign**
2. Enter a name, select attack types, set max rounds
3. Click **Start** — the live log streams results in real time
4. When complete, view the report under **Reports**

Using the API directly:

```bash
# Create campaign
curl -s -X POST http://localhost:8000/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"test","attack_types":["prompt_injection","data_exfiltration"],"max_rounds":5}' | jq .

# Start it (replace 1 with the returned id)
curl -s -X POST http://localhost:8000/campaigns/1/start | jq .

# Poll report when done
curl -s http://localhost:8000/campaigns/1/report | jq .
```

---

## Quick Start (Docker)

```bash
# Copy and edit .env
cp .env.example .env

# Build and start both services
docker compose up --build
```

- Attacker API: `http://localhost:8000`
- Target API: `http://localhost:8001`
- Campaign data persisted in `./data/`
- Logs written to `./logs/`
- Reports written to `./reports/`

The frontend is not containerized by default — run it locally with `npm run dev` pointing at `http://localhost:8000`.

---

## Testing

### Backend

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm test          # run once
npm run test:ui   # interactive UI
```

---

## Project Structure

```
flaw-hunter/
├── attacker/               # Attacker service (port 8000)
│   ├── main.py             # FastAPI app, campaign CRUD, WebSocket
│   ├── models.py           # SQLModel tables: Campaign, Attack, Result, Report
│   ├── loop.py             # Campaign orchestration loop
│   ├── recon.py            # Target surface discovery
│   ├── attack_generator.py # Payload generation (templates + LLM)
│   ├── executor.py         # HTTP attack execution
│   ├── analyzer.py         # LLM-based result analysis
│   ├── memory.py           # In-memory attack record tracking
│   └── target_adapter.py   # HTTP client for target system
│
├── target_system/          # Target service (port 8001)
│   ├── main.py             # FastAPI app: /chat, /tools/*, /config
│   ├── agent.py            # Vulnerable LLM agent (no guardrails)
│   └── tools.py            # search() and send_email() tools
│
├── common/                 # Shared code
│   ├── config.py           # pydantic-settings (reads .env)
│   └── llm_client.py       # ClaudeClient, OllamaClient, get_llm_client()
│
├── evaluation/             # Metrics and scoring
│   ├── metrics.py          # compute_metrics() → success rate, coverage
│   └── scorer.py           # severity_score() → int
│
├── frontend/               # React + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── api.ts          # axios client + WebSocket hook
│   │   ├── types.ts        # TypeScript domain types
│   │   ├── components/     # SeverityBadge, MetricsCard, AttackLogEntry
│   │   └── pages/          # Dashboard, Campaigns, CampaignDetail, Reports
│   └── vite.config.ts
│
├── tests/                  # Python test suite (pytest)
│   ├── conftest.py
│   ├── test_recon.py
│   ├── test_attack_generator.py
│   ├── test_executor.py
│   ├── test_analyzer.py
│   ├── test_memory.py
│   ├── test_loop.py
│   ├── test_api.py
│   └── test_target.py
│
├── data/                   # SQLite DB (volume-mounted in Docker)
├── logs/                   # Attack logs (.jsonl)
├── reports/                # Campaign reports (.json)
│
├── Dockerfile.attacker
├── Dockerfile.target
├── docker-compose.yml
├── requirements.txt        # Production dependencies
├── requirements-dev.txt    # + pytest, respx, pytest-asyncio
└── .env.example
```

---

## API Reference

### Attacker Service (`http://localhost:8000`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/campaigns` | Create a new campaign |
| `GET` | `/campaigns` | List all campaigns |
| `GET` | `/campaigns/{id}` | Get campaign details |
| `POST` | `/campaigns/{id}/start` | Start a campaign (background) |
| `POST` | `/campaigns/{id}/stop` | Stop a running campaign |
| `GET` | `/campaigns/{id}/report` | Get campaign report |
| `WS` | `/ws/campaigns/{id}` | Real-time event stream |

**Create campaign body:**

```json
{
  "name": "my-test",
  "target_url": "http://localhost:8001",
  "attack_types": ["prompt_injection", "data_exfiltration", "tool_abuse", "goal_hijacking"],
  "max_rounds": 5,
  "max_retries": 3
}
```

### Target System (`http://localhost:8001`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Send a message to the vulnerable agent |
| `POST` | `/tools/search` | Call the search tool directly |
| `POST` | `/tools/email` | Call the email tool directly |
| `GET` | `/config` | Leak provider configuration (intentional) |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `claude` | `claude` or `ollama` |
| `ANTHROPIC_API_KEY` | _(empty)_ | Required when `LLM_PROVIDER=claude` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Model name for Ollama |
| `TARGET_URL` | `http://localhost:8001` | Target service URL (attacker reads this) |
| `DATABASE_URL` | `sqlite:///./flaw_hunter.db` | SQLite path; override for Docker volumes |

---

## Safety & Ethics

- Run only against **local sandbox environments** or systems you have explicit written authorization to test
- Never point this tool at production systems or third-party services without permission
- All attack attempts are logged for traceability
- The target system is intentionally vulnerable — do not expose it to untrusted networks
- Follow responsible disclosure practices if you discover real vulnerabilities

---

## License

MIT — see [LICENSE](LICENSE)
