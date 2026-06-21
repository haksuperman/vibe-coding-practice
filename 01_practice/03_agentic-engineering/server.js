import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ *
 * 채팅방 요약 서버
 * 프런트엔드(public/)를 서빙하고, 요약 요청만 OpenAI로 중계한다.
 * OPENAI_API_KEY는 .env에만 있고 브라우저로는 절대 나가지 않는다.
 * ------------------------------------------------------------------ */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
// 한 번에 요약할 수 있는 대략적인 상한(문자). 넘으면 기간을 좁히도록 안내.
const MAX_CHARS = 300_000;

const SYSTEM_PROMPT = `당신은 채팅방 대화를 빠르게 따라잡도록 돕는 한국어 요약 도우미입니다.
입력으로 한 채팅방의 (기간이 필터된) 메시지 로그가 "[시각] 사용자: 내용" 형식으로 주어집니다.
이를 분석해 아래 4개 섹션을 한국어 마크다운으로 작성하세요. 섹션 제목과 순서를 정확히 지키세요.

## 📌 전체 요약
대화의 큰 흐름을 2~4문장으로 정리.

## 💬 핵심 주제·논의
- 오간 주요 토픽을 불릿으로. 각 항목은 한 줄 요약.

## ✅ 결정 사항
- 합의되거나 결정된 내용을 불릿으로. 없으면 "- 없음".

## 📋 액션 아이템
- 해야 할 일을 "- [ ] 내용" 체크박스 형식으로. 가능하면 (담당: 이름) 또는 (기한: ...)을 덧붙임. 없으면 "- 없음".

규칙: 잡담·인사·입퇴장 메시지는 요약에서 제외하고, 근거 없는 과한 추측은 하지 마세요.`;

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/summarize", async (req, res) => {
  const { text, meta } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.",
    });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "요약할 메시지가 없습니다." });
  }
  if (text.length > MAX_CHARS) {
    return res.status(413).json({
      error: `대화량이 너무 많습니다(${text.length.toLocaleString()}자). 기간을 좁혀서 다시 시도해 주세요.`,
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${meta || ""}\n\n${text}` },
      ],
    });
    const summary = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!summary) {
      return res.status(502).json({ error: "요약 결과가 비어 있습니다. 다시 시도해 주세요." });
    }
    res.json({ summary, model: MODEL });
  } catch (err) {
    const status = err?.status || 500;
    const code = err?.code || err?.error?.code;
    let message = "OpenAI 호출 중 오류가 발생했습니다.";
    if (status === 401) message = "OpenAI API 키가 유효하지 않습니다. .env의 OPENAI_API_KEY를 확인하세요.";
    else if (code === "insufficient_quota") message = "OpenAI 계정의 크레딧/사용 한도가 부족합니다. platform.openai.com의 Billing에서 결제 수단·크레딧을 설정하세요.";
    else if (status === 429) message = "요청이 많아 일시적으로 제한되었습니다(429). 잠시 후 다시 시도하세요.";
    else if (status >= 500) message = "OpenAI 서버 오류입니다. 잠시 후 다시 시도하세요.";
    else if (err?.message) message = err.message;
    console.error("[/api/summarize]", status, err?.message || err);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`채팅 요약 앱 실행 중 → http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  OPENAI_API_KEY가 비어 있습니다. .env를 설정해야 요약이 동작합니다.");
  }
});
