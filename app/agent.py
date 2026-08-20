from __future__ import annotations

import re

from openai import OpenAI

from app.config import Settings
from app.knowledge import KnowledgeBase, SearchResult
from app.schemas import AskResponse, Source


SYSTEM_INSTRUCTIONS = """
Anda adalah asisten informasi Coretax untuk pertanyaan umum.

Aturan wajib:
1. Jawab hanya menggunakan KONTEKS RESMI yang diberikan.
2. Jangan menambahkan fakta, tanggal, prosedur, atau persyaratan yang tidak ada dalam konteks.
3. Jangan memberikan keputusan perpajakan personal dan jangan meminta data rahasia pengguna.
4. Jika konteks tidak cukup, nyatakan bahwa pertanyaan perlu diteruskan kepada petugas.
5. Gunakan Bahasa Indonesia yang jelas, singkat, dan tidak menghakimi.
""".strip()


PERSONAL_OR_TRANSACTIONAL_PATTERNS = [
    r"\bnik\s+(saya|aku)\b",
    r"\bnpwp\s+(saya|aku)\b",
    r"\bstatus\s+(pajak|pelaporan|pembayaran)\s+(saya|aku)\b",
    r"\bubah\s+(data|alamat|npwp|nik)\b",
    r"\bhapus\s+(data|akun)\b",
    r"\bkirim\s+(spt|laporan)\b",
    r"\bbayarkan?\b",
]


class CoretaxAgent:
    def __init__(self, settings: Settings, knowledge_base: KnowledgeBase):
        self.settings = settings
        self.knowledge_base = knowledge_base
        self.client = (
            OpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key
            else None
        )

    def ask(self, question: str) -> AskResponse:
        if self._requires_human(question):
            return self._escalate(
                "Pertanyaan menyangkut data personal atau tindakan transaksional."
            )

        results = self.knowledge_base.search(
            question,
            limit=self.settings.max_context_docs,
        )
        if not results or results[0].score < self.settings.min_retrieval_score:
            return self._escalate(
                "Informasi pendukung tidak ditemukan dalam knowledge base."
            )

        sources = [
            Source(
                document=result.chunk.document,
                section=result.chunk.section,
                score=result.score,
                url=result.chunk.source_url,
                source_type=result.chunk.source_type,
            )
            for result in results
        ]

        if not self.client or not self.settings.openai_model:
            return AskResponse(
                status="escalated",
                answer=(
                    "Dokumen terkait ditemukan, tetapi model AI belum dikonfigurasi. "
                    "Pertanyaan diteruskan kepada petugas untuk mencegah jawaban yang tidak terverifikasi."
                ),
                sources=sources,
                escalation_reason="Model AI belum dikonfigurasi.",
            )

        context = self._format_context(results)
        response = self.client.responses.create(
            model=self.settings.openai_model,
            instructions=SYSTEM_INSTRUCTIONS,
            input=f"PERTANYAAN:\n{question}\n\nKONTEKS RESMI:\n{context}",
        )
        answer = response.output_text.strip()
        if not answer:
            return self._escalate("Model tidak menghasilkan jawaban yang dapat digunakan.")

        return AskResponse(status="answered", answer=answer, sources=sources)

    @staticmethod
    def _requires_human(question: str) -> bool:
        normalized = question.lower()
        return any(
            re.search(pattern, normalized)
            for pattern in PERSONAL_OR_TRANSACTIONAL_PATTERNS
        )

    @staticmethod
    def _format_context(results: list[SearchResult]) -> str:
        blocks = []
        for index, result in enumerate(results, start=1):
            blocks.append(
                f"[SUMBER {index}: {result.chunk.document} | "
                f"{result.chunk.section}]\n{result.chunk.content}"
            )
        return "\n\n".join(blocks)

    @staticmethod
    def _escalate(reason: str) -> AskResponse:
        return AskResponse(
            status="escalated",
            answer=(
                "Informasi yang diperlukan belum dapat dipastikan dari sumber yang tersedia. "
                "Pertanyaan ini perlu diteruskan kepada petugas."
            ),
            escalation_reason=reason,
        )
