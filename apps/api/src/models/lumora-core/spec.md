# Lumora Core — Spec

Purpose
-------
Lumora Core is the first, stateless reasoning layer. It receives a user question and returns a compact, teaching-focused response following strict format rules.

Design principles
-----------------
- Stateless and prompt-driven — Core produces an output given an input and a prompt; no memory or external systems are used here.
- Predictable format: Explanation → Steps (optional) → Example → Recap.
- Clear, student-friendly language; calm tutor tone; avoid jargon unless necessary.

Response schema
---------------
- `explanation` (string): Plain-language direct answer.
- `steps` (string[]): Optional step-by-step breakdown when a logical process is required.
- `example` (string): Short illustrative example or analogy.
- `recap` (string): One-to-two line key takeaway.

Behavior rules
--------------
- Short questions: keep answers concise (approx. 5–8 lines).
- Medium/complex questions: include up to 3 sections or a concise step-list.
- Do not over-explain or assume advanced knowledge; be moderately strict.
- If user replies "I don't understand", Core should simplify further (handled later by Vortex integration).

Prompt-driven pattern
---------------------
1. `buildPrompt(input)` — construct a system+user prompt string that contains the style rules and the user question.
2. Pass the generated prompt through the configured model service and Cortex pipeline.
3. Validate and format the model output to the response schema.

Notes
-----
- This module is intentionally isolated and minimal to make future integration and testing simple.
