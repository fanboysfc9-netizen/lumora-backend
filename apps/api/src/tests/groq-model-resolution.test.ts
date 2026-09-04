import test from 'node:test'
import assert from 'node:assert/strict'
import { modelForMode, resolveLumoraModel, SUPPORTED_GROQ_MODEL_IDS } from '../services/model-resolver'

function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('Nira resolves to the configured lightweight Groq model', () => {
  const resolution = resolveLumoraModel('nira')
  assert.equal(resolution.identity, 'nira')
  assert.equal(resolution.model, 'openai/gpt-oss-20b')
  assert.equal(resolution.fallbackUsed, false)
})

test('Elara resolves to the stronger tutoring Groq model', () => {
  const resolution = resolveLumoraModel('elara')
  assert.equal(resolution.identity, 'elara')
  assert.equal(resolution.model, 'qwen/qwen3.6-27b')
  assert.equal(resolution.fallbackUsed, false)
})

test('Solara resolves to the strongest configured Groq model', () => {
  const resolution = resolveLumoraModel('solara')
  assert.equal(resolution.identity, 'solara')
  assert.equal(resolution.model, 'openai/gpt-oss-120b')
  assert.equal(resolution.fallbackUsed, false)
})

test('mode selection maps through Lumora identities', () => {
  assert.equal(modelForMode('standard'), 'nira')
  assert.equal(modelForMode('research'), 'elara')
  assert.equal(modelForMode('creative'), 'solara')
  assert.equal(modelForMode('nira'), 'nira')
  assert.equal(modelForMode('elara'), 'elara')
  assert.equal(modelForMode('solara'), 'solara')
})

test('invalid configured models resolve to the lightweight fallback', () => {
  withEnvironment({ LUMORA_ELARA_MODEL: 'not-a-groq-model', LUMORA_FALLBACK_MODEL: undefined }, () => {
    const resolution = resolveLumoraModel('elara')
    assert.equal(resolution.model, 'openai/gpt-oss-20b')
    assert.equal(resolution.fallbackModel, 'openai/gpt-oss-20b')
    assert.equal(resolution.fallbackUsed, true)
  })
})

test('invalid fallback configuration fails safe to the default lightweight model', () => {
  withEnvironment({ LUMORA_FALLBACK_MODEL: 'not-a-groq-model' }, () => {
    assert.equal(resolveLumoraModel('solara').fallbackModel, 'openai/gpt-oss-20b')
  })
})

test('unknown Lumora model identifiers are rejected safely', () => {
  assert.throws(() => resolveLumoraModel('unknown'), /Unsupported Lumora model/)
})

test('resolved provider IDs come from the centralized supported catalogue', () => {
  for (const identity of ['nira', 'elara', 'solara'] as const) {
    assert.ok(SUPPORTED_GROQ_MODEL_IDS.includes(resolveLumoraModel(identity).model as typeof SUPPORTED_GROQ_MODEL_IDS[number]))
  }
})
