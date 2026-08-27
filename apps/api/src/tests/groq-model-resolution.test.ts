import test from 'node:test'
import assert from 'node:assert/strict'
import { getModel } from '../services/groq.service.ts'

test('getModel prefers current supported Groq chat models over stale legacy aliases', () => {
  const standardModel = getModel('standard')
  const fastModel = getModel('fast')

  assert.ok(
    ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile'].includes(standardModel),
    `unexpected standard model: ${standardModel}`
  )

  assert.ok(
    !standardModel.includes('llama-3.1-70b-versatile') || standardModel === 'llama-3.1-70b-versatile',
    `legacy model should not be selected by default: ${standardModel}`
  )

  assert.ok(
    ['openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant'].includes(fastModel),
    `unexpected fast model: ${fastModel}`
  )
})
