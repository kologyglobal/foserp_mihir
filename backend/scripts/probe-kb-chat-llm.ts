import { hasKnowledgeGenerativeLlm, resolveKnowledgeChatLlmConfig } from '../src/modules/knowledge/llm-config.js'
import { streamChatCompletion } from '../src/modules/knowledge/chat/llm.js'

async function main() {
  const cfg = resolveKnowledgeChatLlmConfig()
  console.log('hasKnowledgeGenerativeLlm:', hasKnowledgeGenerativeLlm())
  console.log('resolved provider/transport:', cfg ? { provider: cfg.provider, transport: cfg.transport, model: cfg.model, baseUrl: cfg.baseUrl } : null)

  if (!cfg) {
    console.log('No generative config resolved — check GEMINI_API_KEY/OPENAI_API_KEY in backend/.env')
    return
  }

  if (cfg.transport === 'gemini-native') {
    const res = await fetch(`${cfg.baseUrl}/models/${cfg.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say hi.' }] }] }),
    })
    const body = await res.text().catch(() => '')
    console.log('raw HTTP status:', res.status)
    console.log('raw body (truncated):', body.slice(0, 600))
  }

  const result = await streamChatCompletion(
    [
      { role: 'system', content: 'You are a test assistant. Reply with a short greeting only.' },
      { role: 'user', content: 'Say hello in five words or fewer.' },
    ],
    { onToken: () => {} },
  )

  console.log('result.provider:', result.provider)
  console.log('result.modelId:', result.modelId)
  console.log('result.content:', result.content)
}

main().catch((err) => {
  console.error('probe failed:', err)
  process.exit(1)
})
