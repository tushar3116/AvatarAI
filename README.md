# 🤖 Interactive AI Avatar Platform

A real-time multilingual document-aware AI Avatar conversation platform. Upload a document and chat with an AI Avatar that becomes an expert on its content.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Upload   │  │ Avatar Frame │  │   Transcript     │  │
│  │  Panel    │  │  (Canvas)    │  │   Panel          │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
│                 ┌──────────────┐                        │
│                 │ Speak Button │                        │
│                 └──────┬───────┘                        │
└────────────────────────┼────────────────────────────────┘
                         │ WebSocket (binary audio + JSON)
┌────────────────────────┼────────────────────────────────┐
│                  Backend (FastAPI)                       │
│                        ▼                                │
│  Audio ──► Whisper STT ──► LangChain RAG ──► ElevenLabs│
│                              │                   │      │
│                         ChromaDB              TTS Audio  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Frontend | React, Vite, Tailwind CSS, Lucide Icons       |
| Backend  | FastAPI, WebSocket, Python                    |
| AI/LLM   | OpenAI GPT-4o, Whisper                        |
| RAG      | LangChain, ChromaDB, OpenAI Embeddings        |
| TTS      | ElevenLabs (Turbo v2.5) / OpenAI TTS fallback |
| Avatar   | Canvas-based with speaking animations         |

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 3. Usage

1. **Upload a Document** — Drag a PDF/TXT into the left panel
2. **Wait for Indexing** — The document is chunked and embedded into ChromaDB
3. **Start Talking** — Hold the speak button and ask questions about your document
4. **Listen & Read** — The AI Avatar responds with audio + live transcript

## API Keys Required

| Service    | Key                  | Purpose                                             |
| ---------- | -------------------- | --------------------------------------------------- |
| OpenAI     | `OPENAI_API_KEY`     | GPT-4o reasoning + Whisper STT                      |
| ElevenLabs | `ELEVENLABS_API_KEY` | Text-to-Speech (optional, falls back to OpenAI TTS) |
| Simli      | `SIMLI_API_KEY`      | Avatar animation (optional)                         |

## Key Features

- **🌐 Multilingual**: Hindi, English, and Hinglish support
- **⚡ Interrupt Logic**: Press speak again to cancel in-flight responses
- **🎭 Animated Avatar**: Canvas-based with breathing/speaking animations
- **📄 RAG Pipeline**: Document-grounded responses (never hallucinates)
- **🎙️ Real-time**: WebSocket streaming with low-latency pipeline
