"""임베딩 공급자. 서비스 계층은 `get_embeddings()`만 호출한다.

LLM 채팅과 같은 원칙이다. 공급자 교체는 `.env`로 하고, 테스트는 키 없이 돈다.
"""

from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings
from pydantic import SecretStr

from app.core.config import settings
from app.llm.rag.fake_embeddings import HashingFakeEmbeddings

# 벡터 차원. 바꾸면 기존에 저장한 임베딩과 맞지 않으므로 마이그레이션이 필요하다.
EMBEDDING_DIMENSIONS = 1536


def get_embeddings() -> Embeddings:
    if settings.LLM_PROVIDER == "fake":
        # 같은 입력에 항상 같은 벡터를 주므로 테스트 결과가 일정하다.
        return HashingFakeEmbeddings(size=EMBEDDING_DIMENSIONS)

    return OpenAIEmbeddings(
        model=settings.RAG_EMBEDDING_MODEL,
        dimensions=EMBEDDING_DIMENSIONS,
        api_key=SecretStr(settings.llm_api_key) if settings.llm_api_key else None,
        base_url=settings.LLM_BASE_URL or None,
    )
