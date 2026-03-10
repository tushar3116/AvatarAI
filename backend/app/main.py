"""
FastAPI Streaming Backend.

Provides REST endpoints for document ingestion and a WebSocket endpoint
for real-time voice conversation: Audio → Whisper STT → LangChain Agent → ElevenLabs TTS.
"""

import asyncio
import base64
import io
import json
import logging
import os
import tempfile
import traceback
from typing import Optional

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

from app.config import get_settings
from app.models import (
    IngestResponse,
    CollectionsResponse,
    CollectionInfo,
    WSMessageType,
    WSOutgoingMessage,
)
from app.ingest import ingest_document, list_collections
from app.agent import get_agent_response

# ─── Logging ─────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App Setup ───────────────────────────────────────────────

app = FastAPI(
    title="AI Avatar Platform API",
    description="Real-time multilingual document-aware avatar conversation",
    version="1.0.0",
)

# CORS Middleware — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ────────────────────────────────────────────

@app.get("/")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "AI Avatar Platform"}


# ─── Document Ingestion ─────────────────────────────────────

@app.post("/api/v1/ingest", response_model=IngestResponse)
async def ingest_file(file: UploadFile = File(...)):
    """
    Upload and ingest a PDF or text file into the knowledge base.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    allowed_extensions = {".pdf", ".txt", ".text", ".md"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    # Save to temp file
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Run ingestion (blocking, but fast enough for MVP)
        collection_name, chunks_count = await asyncio.to_thread(
            ingest_document, tmp_path, file.filename
        )

        return IngestResponse(
            success=True,
            collection_name=collection_name,
            chunks_count=chunks_count,
            message=f"Successfully indexed '{file.filename}' into collection '{collection_name}' ({chunks_count} chunks)",
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Ingestion error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        # Cleanup temp file
        if "tmp_path" in locals():
            os.unlink(tmp_path)


@app.get("/api/v1/collections", response_model=CollectionsResponse)
async def get_collections():
    """List all available document collections."""
    try:
        collections = await asyncio.to_thread(list_collections)
        return CollectionsResponse(
            collections=[CollectionInfo(**c) for c in collections]
        )
    except Exception as e:
        logger.error(f"Error listing collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── WebSocket: Real-time Conversation ──────────────────────

class ConversationSession:
    """Manages state for a single WebSocket conversation session."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.collection_name: Optional[str] = None
        self.is_processing = False
        self.cancel_event = asyncio.Event()

    async def send_message(self, msg: WSOutgoingMessage):
        """Send a message to the client."""
        if self.websocket.client_state == WebSocketState.CONNECTED:
            await self.websocket.send_text(msg.model_dump_json())

    async def send_error(self, error: str):
        """Send an error message to the client."""
        await self.send_message(WSOutgoingMessage(
            type=WSMessageType.ERROR,
            data=error,
        ))

    async def send_status(self, status: str):
        """Send a status update to the client."""
        await self.send_message(WSOutgoingMessage(
            type=WSMessageType.STATUS,
            data=status,
        ))


async def transcribe_audio(audio_bytes: bytes) -> str:
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        audio_bytes: Raw audio data (webm/opus from browser).

    Returns:
        Transcribed text string.
    """
    import openai

    settings = get_settings()
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.webm"

    try:
        transcript = await asyncio.to_thread(
            lambda: client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        )
        return transcript.strip()
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        raise RuntimeError(f"Transcription failed: {str(e)}")


async def generate_tts_audio(text: str) -> bytes:
    """
    Generate speech audio from text using ElevenLabs.

    Args:
        text: Text to convert to speech.

    Returns:
        Audio bytes (mp3 format).
    """
    settings = get_settings()

    if not settings.ELEVENLABS_API_KEY:
        # Fallback: use OpenAI TTS if ElevenLabs key not available
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        try:
            response = await asyncio.to_thread(
                lambda: client.audio.speech.create(
                    model="tts-1",
                    voice="alloy",
                    input=text,
                    response_format="mp3",
                )
            )
            return response.content
        except Exception as e:
            logger.error(f"OpenAI TTS error: {e}")
            raise RuntimeError(f"TTS generation failed: {str(e)}")

    # ElevenLabs TTS
    from elevenlabs import ElevenLabs

    try:
        client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

        audio_generator = await asyncio.to_thread(
            lambda: client.text_to_speech.convert(
                voice_id=settings.ELEVENLABS_VOICE_ID,
                text=text,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )
        )

        # Collect all audio chunks
        audio_bytes = b""
        for chunk in audio_generator:
            audio_bytes += chunk

        return audio_bytes

    except Exception as e:
        logger.error(f"ElevenLabs TTS error: {e}")
        raise RuntimeError(f"TTS generation failed: {str(e)}")


@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time voice conversation.

    Protocol:
    - Client sends JSON: {"type": "session_start", "collection_name": "..."}
    - Client sends binary: raw audio data
    - Client sends JSON: {"type": "stop"} to interrupt
    - Server sends JSON: WSOutgoingMessage (transcript, agent_reply, audio_response, error)
    """
    await websocket.accept()
    session = ConversationSession(websocket)

    logger.info("WebSocket connection established")

    try:
        while True:
            message = await websocket.receive()

            # ── Handle text (JSON) messages ──
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "session_start":
                        session.collection_name = data.get("collection_name")
                        await session.send_status(
                            f"Session started with collection: {session.collection_name}"
                        )
                        logger.info(f"Session started: {session.collection_name}")

                    elif msg_type == "stop":
                        # Interrupt: cancel any in-flight processing
                        session.cancel_event.set()
                        session.is_processing = False
                        await session.send_status("Processing interrupted")
                        logger.info("Processing interrupted by client")

                except json.JSONDecodeError:
                    await session.send_error("Invalid JSON message")

            # ── Handle binary (audio) messages ──
            elif "bytes" in message:
                audio_data = message["bytes"]

                if not session.collection_name:
                    await session.send_error(
                        "No collection selected. Send a session_start message first."
                    )
                    continue

                if session.is_processing:
                    # Already processing — send interrupt first
                    session.cancel_event.set()
                    await asyncio.sleep(0.1)

                # Reset cancel event and start processing
                session.cancel_event.clear()
                session.is_processing = True

                try:
                    # Step 1: Transcribe audio with Whisper
                    await session.send_status("Transcribing audio...")
                    transcript = await transcribe_audio(audio_data)

                    if session.cancel_event.is_set():
                        continue

                    if not transcript:
                        await session.send_status("No speech detected")
                        session.is_processing = False
                        continue

                    # Send transcript to client
                    await session.send_message(WSOutgoingMessage(
                        type=WSMessageType.TRANSCRIPT,
                        data=transcript,
                    ))

                    # Step 2: Get agent response
                    await session.send_status("Thinking...")

                    if session.cancel_event.is_set():
                        continue

                    agent_result = await asyncio.to_thread(
                        get_agent_response,
                        transcript,
                        session.collection_name,
                    )

                    if session.cancel_event.is_set():
                        continue

                    # Send agent reply to client
                    await session.send_message(WSOutgoingMessage(
                        type=WSMessageType.AGENT_REPLY,
                        data=agent_result.response,
                    ))

                    # Step 3: Generate TTS audio
                    await session.send_status("Generating speech...")

                    if session.cancel_event.is_set():
                        continue

                    audio_bytes = await generate_tts_audio(agent_result.response)

                    if session.cancel_event.is_set():
                        continue

                    # Send audio as base64 to client
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await session.send_message(WSOutgoingMessage(
                        type=WSMessageType.AUDIO_RESPONSE,
                        audio_base64=audio_b64,
                        data=agent_result.response,
                        is_final=True,
                    ))

                except RuntimeError as e:
                    await session.send_error(str(e))
                except Exception as e:
                    logger.error(f"Processing error: {traceback.format_exc()}")
                    await session.send_error(f"Processing error: {str(e)}")
                finally:
                    session.is_processing = False

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {traceback.format_exc()}")
    finally:
        logger.info("WebSocket connection closed")


# ─── Startup ─────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    settings = get_settings()
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    logger.info("AI Avatar Platform API started")
    logger.info(f"ChromaDB persist dir: {settings.CHROMA_PERSIST_DIR}")

    # Log API key status (not the keys themselves)
    logger.info(f"OpenAI API Key: {'✓ configured' if settings.OPENAI_API_KEY else '✗ missing'}")
    logger.info(f"ElevenLabs API Key: {'✓ configured' if settings.ELEVENLABS_API_KEY else '✗ missing (will use OpenAI TTS)'}")
    logger.info(f"Simli API Key: {'✓ configured' if settings.SIMLI_API_KEY else '✗ missing (avatar fallback)'}")
