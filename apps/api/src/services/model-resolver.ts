export type LumoraModel = 'nira' | 'elara' | 'solara'

export type ModelResolution = {
  identity: LumoraModel
  provider: 'groq'
  model: string
  fallbackModel: string
  fallbackUsed: boolean
}

const DEFAULT_MODELS: Record<LumoraModel, string> = {
  nira: 'openai/gpt-oss-20b',
  elara: 'qwen/qwen3.6-27b',
  solara: 'openai/gpt-oss-120b'
}

const MODEL_ENV_KEYS: Record<LumoraModel, string> = {
  nira: 'LUMORA_NIRA_MODEL',
  elara: 'LUMORA_ELARA_MODEL',
  solara: 'LUMORA_SOLARA_MODEL'
}

const FALLBACK_ENV_KEY = 'LUMORA_FALLBACK_MODEL'

export const SUPPORTED_GROQ_MODEL_IDS = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b'
] as const

const SUPPORTED_GROQ_MODELS = new Set<string>(SUPPORTED_GROQ_MODEL_IDS)

function configuredModel(identity: LumoraModel) {
  return process.env[MODEL_ENV_KEYS[identity]]?.trim() || DEFAULT_MODELS[identity]
}

function configuredFallbackModel() {
  return process.env[FALLBACK_ENV_KEY]?.trim() || DEFAULT_MODELS.nira
}

function isSupportedModel(model: string) {
  return SUPPORTED_GROQ_MODELS.has(model)
}

export function modelForMode(mode: string): LumoraModel {
  switch (mode) {
    case 'nira':
      return 'nira'
    case 'elara':
      return 'elara'
    case 'solara':
      return 'solara'
    case 'coding':
    case 'research':
      return 'elara'
    case 'creative':
      return 'solara'
    case 'standard':
    case 'fast':
    default:
      return 'nira'
  }
}

export function resolveLumoraModel(identity: string = 'nira'): ModelResolution {
  const normalized = identity.trim().toLowerCase()
  if (normalized !== 'nira' && normalized !== 'elara' && normalized !== 'solara') {
    throw new RangeError(`Unsupported Lumora model: ${identity}`)
  }

  const selectedIdentity = normalized as LumoraModel
  const fallbackModel = isSupportedModel(configuredFallbackModel()) ? configuredFallbackModel() : DEFAULT_MODELS.nira
  const configuredPrimary = configuredModel(selectedIdentity)
  const model = isSupportedModel(configuredPrimary) ? configuredPrimary : fallbackModel

  return {
    identity: selectedIdentity,
    provider: 'groq',
    model,
    fallbackModel,
    fallbackUsed: model !== configuredPrimary
  }
}
