from __future__ import annotations

import re

from openai import OpenAI

from app.config import Settings
from app.knowledge import KnowledgeBase, SearchResult
from app.schemas import AskResponse, Source


SYSTEM_INSTRUCTIONS = """
Anda adalah asisten informasi Badan Pengawas Obat dan Makanan (BPOM) untuk
pertanyaan umum masyarakat dan pelaku usaha.

Aturan wajib:
1. Jawab hanya menggunakan KONTEKS RESMI yang diberikan.
2. Jangan menambahkan fakta, tanggal, prosedur, atau persyaratan yang tidak ada dalam konteks.
3. Jangan menilai keamanan, mutu, atau kelayakan produk tertentu, dan jangan meminta data rahasia pengguna.
4. Konteks berisi teks peraturan. Sebutkan nomor dan tahun peraturan saat mengutip ketentuan.
5. Jika peraturan dalam konteks berstatus dicabut, nyatakan hal itu dan jangan jadikan dasar jawaban.
6. Jika konteks tidak cukup, nyatakan bahwa pertanyaan perlu diteruskan kepada petugas.
7. Gunakan Bahasa Indonesia yang jelas, singkat, dan tidak menghakimi.
""".strip()


# Questions that must reach a human rather than be answered from regulation
# text: anything about one company's own filing, anything asking the agent to
# act, anything fishing for credentials, and — specific to this domain — asking
# it to pronounce a named product safe.
PERSONAL_OR_TRANSACTIONAL_PATTERNS = [
    r"\bnik\s+(saya|aku)\b",
    r"\bnib\s+(saya|aku|kami)\b",
    r"\b(nie|nomor\s+izin\s+edar)\s+(saya|aku|kami)\b",
    # The possessive rarely sits next to the noun — "status permohonan izin edar
    # kami" puts two words in between — so allow a short gap.
    r"\bstatus\s+(registrasi|pendaftaran|permohonan|izin|sertifikat)\b.{0,30}\b(saya|aku|kami)\b",
    r"\bproduk\s+(saya|aku|kami)\b",
    r"\bperusahaan\s+(saya|aku|kami)\b",
    r"\bubah\s+(data|alamat|nib|nik|registrasi)\b",
    r"\bhapus\s+(data|akun|registrasi)\b",
    r"\bkirim(kan)?\s+(berkas|dokumen|sertifikat|laporan|file)\b",
    r"\bdaftarkan?\s+produk\b",
    r"\bbayarkan?\b",
    r"\b(apa|berikan|kasih\s+tahu|beritahu|kirim(kan)?)\b.{0,20}\b(otp|password|kata sandi|passphrase)\b",
    r"\bapakah\s+produk\b.{0,30}\b(aman|halal|berbahaya|boleh\s+dikonsumsi)\b",
]


class BpomAgent:
    def __init__(self, settings: Settings, knowledge_base: KnowledgeBase):
        self.settings = settings
        self.knowledge_base = knowledge_base
        # The OpenAI SDK is kept only as an HTTP client for the OpenAI-compatible
        # wire format; base_url decides which provider actually answers.
        self.client = (
            OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
            if settings.llm_api_key
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

        if not self.client or not self.settings.llm_model:
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
        # Chat completions rather than the Responses API: the latter is
        # OpenAI-only, and this call has to reach whichever provider the model
        # id points at.
        response = self.client.chat.completions.create(
            model=self.settings.llm_model,
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {
                    "role": "user",
                    "content": f"PERTANYAAN:\n{question}\n\nKONTEKS RESMI:\n{context}",
                },
            ],
        )
        answer = (response.choices[0].message.content or "").strip()
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
