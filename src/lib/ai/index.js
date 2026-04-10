import { ClaudeProvider } from './providers/claude.js'

const PROVIDERS = {
  claude: ClaudeProvider,
}

const providerKey = import.meta.env.VITE_AI_PROVIDER || 'claude'
const ProviderClass = PROVIDERS[providerKey]

if (!ProviderClass) {
  throw new Error(`Unknown AI provider: "${providerKey}". Valid options: ${Object.keys(PROVIDERS).join(', ')}`)
}

const provider = new ProviderClass()

export function generateText(options) {
  return provider.generateText(options)
}
