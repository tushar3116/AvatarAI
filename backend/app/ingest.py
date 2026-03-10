"""
Knowledge Ingestion Module.

Takes PDF/Text files, chunks them using RecursiveCharacterTextSplitter,
generates embeddings via OpenAIEmbeddings, and persists to ChromaDB.
"""

import os
import logging
from pathlib import Path
from typing import Tuple

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from pypdf import PdfReader

from app.config import get_settings

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file."""
    reader = PdfReader(file_path)
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_from_txt(file_path: str) -> str:
    """Extract text content from a plain text file."""
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def sanitize_collection_name(filename: str) -> str:
    """
    Sanitize filename to be a valid ChromaDB collection name.
    Rules: 3-63 chars, alphanumeric + underscores/hyphens, 
    must start/end with alphanumeric.
    """
    name = Path(filename).stem
    # Replace non-alphanumeric chars with underscores
    sanitized = "".join(c if c.isalnum() else "_" for c in name)
    # Remove leading/trailing underscores
    sanitized = sanitized.strip("_")
    # Ensure length constraints
    if len(sanitized) < 3:
        sanitized = sanitized + "_doc"
    if len(sanitized) > 63:
        sanitized = sanitized[:63].rstrip("_")
    # Ensure starts and ends with alphanumeric
    if not sanitized[0].isalnum():
        sanitized = "d" + sanitized
    if not sanitized[-1].isalnum():
        sanitized = sanitized + "0"
    return sanitized.lower()


def ingest_document(file_path: str, filename: str) -> Tuple[str, int]:
    """
    Ingest a document into ChromaDB.

    Args:
        file_path: Path to the temporary uploaded file.
        filename: Original filename for collection naming.

    Returns:
        Tuple of (collection_name, chunks_count)

    Raises:
        ValueError: If file type is not supported.
        RuntimeError: If ingestion fails.
    """
    settings = get_settings()

    # Determine file type and extract text
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif ext in (".txt", ".text", ".md"):
        text = extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .pdf, .txt, .md")

    if not text.strip():
        raise ValueError("No text content found in the uploaded file.")

    logger.info(f"Extracted {len(text)} characters from {filename}")

    # Chunk the text
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    logger.info(f"Created {len(chunks)} chunks from {filename}")

    if not chunks:
        raise ValueError("Document produced no text chunks after splitting.")

    # Create embeddings and store in ChromaDB
    collection_name = sanitize_collection_name(filename)
    persist_dir = settings.CHROMA_PERSIST_DIR

    # Ensure persist directory exists
    os.makedirs(persist_dir, exist_ok=True)

    embeddings = OpenAIEmbeddings(
        openai_api_key=settings.OPENAI_API_KEY,
        model="text-embedding-3-small",
    )

    # Create or overwrite the collection
    vectorstore = Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=persist_dir,
        metadatas=[{"source": filename, "chunk_index": i} for i in range(len(chunks))],
    )

    logger.info(f"Stored {len(chunks)} chunks in collection '{collection_name}'")

    return collection_name, len(chunks)


def list_collections() -> list[dict]:
    """
    List all available ChromaDB collections.

    Returns:
        List of dicts with 'name' and 'document_count' keys.
    """
    import chromadb

    settings = get_settings()
    persist_dir = settings.CHROMA_PERSIST_DIR

    if not os.path.exists(persist_dir):
        return []

    client = chromadb.PersistentClient(path=persist_dir)
    collections = client.list_collections()

    result = []
    for col in collections:
        collection = client.get_collection(col.name)
        result.append({
            "name": col.name,
            "document_count": collection.count(),
        })

    return result
