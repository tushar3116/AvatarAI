"""
Brain & Logic Module — LangChain RAG Agent.

Detects input language (Hindi/English/Hinglish), retrieves context from
ChromaDB, and generates concise responses in the user's language.
"""

import logging
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from app.config import get_settings
from app.models import AgentResponse

logger = logging.getLogger(__name__)

# ─── System Prompt ───────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert AI assistant powered by a knowledge base. 
You are an AI assistant in India. You understand Hinglish (Hindi + English mix). 
If a user asks a question in Hindi, respond in clear, formal Hindi. 
If they use a mix of Hindi and English (Hinglish), respond in a helpful, natural Hinglish tone.
If they ask in English, respond in English.

IMPORTANT RULES:
1. ONLY answer based on the provided context. If the context doesn't contain the answer, say so politely.
2. Keep your responses CONCISE — under 3 sentences maximum. This is critical for low-latency video generation.
3. Be warm, professional, and conversational — you are speaking through a video avatar.
4. Never mention "context" or "documents" — speak as if you inherently know the information.

Context from the knowledge base:
{context}

User's question: {question}

Your concise response:"""


def _format_docs(docs) -> str:
    """Format retrieved documents into a single context string."""
    return "\n\n---\n\n".join(doc.page_content for doc in docs)


def get_agent_response(query: str, collection_name: str) -> AgentResponse:
    """
    Process a user query through the RAG pipeline.

    Args:
        query: The user's question/statement.
        collection_name: ChromaDB collection to search.

    Returns:
        AgentResponse with the AI's response and metadata.

    Raises:
        RuntimeError: If the agent fails to generate a response.
    """
    settings = get_settings()

    try:
        # Initialize components
        embeddings = OpenAIEmbeddings(
            openai_api_key=settings.OPENAI_API_KEY,
            model="text-embedding-3-small",
        )

        vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIR,
        )

        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4},
        )

        llm = ChatOpenAI(
            model="gpt-4o",
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.3,
            max_tokens=200,  # Keep responses short for latency
            request_timeout=15,  # 15s timeout
        )

        prompt = ChatPromptTemplate.from_template(SYSTEM_PROMPT)

        # Build RAG chain
        rag_chain = (
            {
                "context": retriever | _format_docs,
                "question": RunnablePassthrough(),
            }
            | prompt
            | llm
            | StrOutputParser()
        )

        # Execute
        response_text = rag_chain.invoke(query)

        # Detect language of the response (simple heuristic)
        detected_lang = _detect_language(response_text)

        # Get source docs for metadata
        source_docs = retriever.invoke(query)
        sources = list(set(
            doc.metadata.get("source", "unknown") for doc in source_docs
        ))

        logger.info(f"Agent response generated ({detected_lang}): {response_text[:80]}...")

        return AgentResponse(
            response=response_text,
            source_documents=sources,
            detected_language=detected_lang,
        )

    except Exception as e:
        logger.error(f"Agent error: {str(e)}")
        raise RuntimeError(f"Agent failed to generate response: {str(e)}")


def _detect_language(text: str) -> str:
    """
    Simple heuristic language detection.
    Checks for Devanagari script presence to detect Hindi/Hinglish.
    """
    devanagari_count = sum(1 for c in text if "\u0900" <= c <= "\u097F")
    total_alpha = sum(1 for c in text if c.isalpha())

    if total_alpha == 0:
        return "en"

    ratio = devanagari_count / total_alpha

    if ratio > 0.5:
        return "hi"
    elif ratio > 0.1:
        return "hinglish"
    else:
        return "en"
