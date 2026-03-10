"""
Pydantic models for strict data validation between layers.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


# ─── Ingest Models ───────────────────────────────────────────

class IngestResponse(BaseModel):
    """Response after document ingestion."""
    success: bool
    collection_name: str
    chunks_count: int
    message: str


class CollectionInfo(BaseModel):
    """Information about a ChromaDB collection."""
    name: str
    document_count: int


class CollectionsResponse(BaseModel):
    """Response listing all available collections."""
    collections: list[CollectionInfo]


# ─── WebSocket Protocol Models ───────────────────────────────

class WSMessageType(str, Enum):
    """Types of WebSocket messages."""
    AUDIO_CHUNK = "audio_chunk"
    STOP = "stop"
    TRANSCRIPT = "transcript"
    AGENT_REPLY = "agent_reply"
    AUDIO_RESPONSE = "audio_response"
    AVATAR_DATA = "avatar_data"
    ERROR = "error"
    STATUS = "status"
    SESSION_START = "session_start"


class WSIncomingMessage(BaseModel):
    """Message from client to server (JSON control messages)."""
    type: WSMessageType
    collection_name: Optional[str] = None
    data: Optional[str] = None


class WSOutgoingMessage(BaseModel):
    """Message from server to client."""
    type: WSMessageType
    data: Optional[str] = None
    audio_base64: Optional[str] = None
    is_final: bool = False


# ─── Agent Models ────────────────────────────────────────────

class AgentQuery(BaseModel):
    """Input to the LangChain agent."""
    query: str
    collection_name: str
    language_hint: Optional[str] = None


class AgentResponse(BaseModel):
    """Output from the LangChain agent."""
    response: str
    source_documents: list[str] = Field(default_factory=list)
    detected_language: str = "en"
