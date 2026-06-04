# Lumora Core v2 — Smart Tutor Engine (Spec)

Overview
--------
Lumora Core v2 is a stateless, prompt-driven teaching-control layer that shapes how LLM responses are formed to feel like a patient, thinking tutor. It does not call external APIs or store memory — it only normalizes input and builds/validates prompt packages for downstream models.

Key Behaviors
-------------
- Thinking-first teaching: build intuition before giving direct answers.
- Tutor personality: calm, patient, approachable; simple English; no overconfidence.
- Cognitive structure enforced in every prompt: Explanation → Why it works (intuition) → Steps (if needed) → Example → Recap.
- Difficulty adaptation: EASY / MEDIUM / HARD adjusts depth and length of responses.
- No answer dumping or chain-of-thought leakage.

Prompt Package
--------------
Consists of a `prompt` string and `metadata` describing `difficulty`, `intent`, and `subject` hints. Downstream layers (Cortex Adapt, Groq) must only receive the processed prompt and the user message.

Integration Points
------------------
- Cortex Adapt hook (planned): optional analyze(input, context) for personalization.
- Cortex Refine hook (planned): optional refine(response) for clarity polishing.

Developer Notes
---------------
- Prompt builder auto-detects difficulty by input length but accepts explicit override.
- Prompt package enforces labeled sections exactly to make downstream parsing reliable.
