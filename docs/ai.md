# AutoGenius — AI Architecture

Golden rule: **Qwen never produces free text that is shown directly to users.**
All AI output is structured JSON, schema-validated, safety-filtered, then rendered.

## Pipeline

```
User question / quotation
        ↓
Intent detection
        ↓
Vehicle context assembly (vehicle + history + odometer)
        ↓
Prompt construction (system prompt + context + schema)
        ↓
AI service (Python) → AiProvider interface → Qwen
        ↓
Structured JSON
        ↓
Schema validation (zod / pydantic)
        ↓
Safety rules layer
        ↓
Persist (ai_messages / quotations.analysis)
        ↓
Mobile UI
```

## Provider isolation

NestJS talks to an `AiProvider` interface:

```ts
interface AiProvider {
  chat(request: AiChatRequest): Promise<StructuredAiResponse>;
  analyzeQuotation(request: QuotationAnalysisRequest): Promise<QuotationAnalysis>;
}
```

Implementations: `MockAiProvider` (default in dev/tests), `QwenProvider`
(via the Python AI service). Swapping providers must not change API behavior.

## Failure handling

- Malformed AI output → retry once with repair prompt, then return a graceful
  "could not analyze" response. Never crash the request.
- Provider timeout (configurable, default 30s) → 504-style friendly error.
- Provider errors → logged with request metadata only (no PII), user gets a
  safe fallback message.
- Rate limiting on AI endpoints (Redis token bucket).

## Safety rules (hard requirements)

AutoGenius is **not a mechanic and must not pretend to be one.**

1. Dangerous symptoms (brake failure, steering failure, smoke, fuel leakage,
   overheating, electrical burning smell, engine seizure, airbag warning, major
   accident damage) → response must prioritize **stop/avoid driving +
   professional inspection**, never false confidence.
2. Never guarantee a diagnosis; never guarantee a repair cost.
3. Costs are always ranges, always with currency (INR), always approximate.
4. Distinguish symptoms from diagnosis; state uncertainty.
5. Ask follow-up questions where they materially improve the assessment.
6. Never recommend unsafe driving.

## Quotation analysis language rules

- Never declare an item definitely fraudulent or unnecessary.
- Use "potentially worth questioning", not "this is a scam".
- If evidence is insufficient → `UNKNOWN` with an explanation. Never invent prices.

## System prompt (AI mechanic, abridged)

```
You are AutoGenius AI, an automotive information assistant.
1. Use the supplied vehicle context.
2. Never claim certainty when diagnosis cannot be confirmed.
3. Return structured JSON according to the supplied schema.
4. Prioritize safety.
5. Recommend professional inspection for safety-critical issues.
6. Give cost estimates only as approximate ranges.
7. Never invent vehicle specifications.
8. Clearly separate likely causes from confirmed facts.
9. Ask relevant follow-up questions when required.
10. Never recommend unsafe driving.
```

The full quotation-analysis prompt lives in the AI service and mirrors section 17
of the V1 specification (uncertainty-aware, JSON-only output, Indian market context).

## Prompt-injection defense

- Quotation OCR text and user messages are treated as untrusted data, wrapped in
  delimiters, and never allowed to override the system prompt.
- AI output is parsed as JSON only; anything outside the schema is discarded.
- AI output can never trigger application commands.
