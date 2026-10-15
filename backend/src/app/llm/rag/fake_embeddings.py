"""테스트·CI용 임베딩. 실제 모델을 부르지 않는다.

글자 2-gram을 해시해 벡터를 만든다. 의미를 이해하지는 못하지만, **같은 표현을 공유하는 글끼리
유사도가 높게** 나오므로 검색 결과의 순서를 검증할 수 있다.
(단어 단위로 자르면 "연차"와 "연차는"이 전혀 다른 토큰이 되어 한국어에서 잘 맞지 않는다.)

무작위 벡터를 쓰지 않는 이유: 순서가 의미 없어져 "검색이 되는지"를 테스트할 수 없다.
"""

import hashlib
import math
import re

from langchain_core.embeddings import Embeddings

_NORMALIZE = re.compile(r"\s+")


def _bigrams(text: str) -> list[str]:
    cleaned = _NORMALIZE.sub(" ", text.strip().lower())
    if len(cleaned) < 2:
        return [cleaned] if cleaned else []
    return [cleaned[i : i + 2] for i in range(len(cleaned) - 1)]


class HashingFakeEmbeddings(Embeddings):
    """해시 기반 결정적 임베딩. 같은 입력이면 항상 같은 벡터."""

    def __init__(self, size: int) -> None:
        self.size = size

    def _embed(self, text: str) -> list[float]:
        vector = [0.0] * self.size

        for gram in _bigrams(text):
            digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
            vector[int.from_bytes(digest, "big") % self.size] += 1.0

        # 길이가 다른 글을 공정하게 비교하려면 단위 벡터로 맞춰야 한다.
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            # 빈 글도 저장은 되어야 하므로 0 벡터 대신 한 축만 세운다.
            vector[0] = 1.0
            return vector

        return [value / norm for value in vector]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)
