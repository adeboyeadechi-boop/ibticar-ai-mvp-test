/**
 * AI Client - Main entry point for AI operations
 * Provides a unified interface to interact with different AI providers
 */

import type {
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  IAIProvider,
} from './types'
import { ClaudeProvider } from './providers/claude'
import { LocalProvider, VLLMProvider } from './providers/local'

// Singleton instance
let aiClientInstance: AIClient | null = null

export class AIClient {
  private provider: IAIProvider
  private providerName: string

  private constructor(config: AIProviderConfig) {
    this.providerName = config.provider

    switch (config.provider) {
      case 'claude':
        this.provider = new ClaudeProvider(config)
        break
      case 'local':
        // Check if baseUrl suggests vLLM (OpenAI-compatible)
        if (config.baseUrl?.includes('v1')) {
          this.provider = new VLLMProvider(config)
        } else {
          this.provider = new LocalProvider(config)
        }
        break
      case 'openai':
        // Future: OpenAI provider
        throw new Error('OpenAI provider not yet implemented')
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`)
    }
  }

  /**
   * Initialize the AI client (singleton)
   */
  static initialize(config?: AIProviderConfig): AIClient {
    if (!aiClientInstance) {
      const defaultConfig: AIProviderConfig = {
        provider: (process.env.AI_PROVIDER as any) || 'claude',
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseUrl: process.env.AI_BASE_URL,
        model:
          process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
      }

      aiClientInstance = new AIClient(config || defaultConfig)
    }

    return aiClientInstance
  }

  /**
   * Get the current instance (throws if not initialized)
   */
  static getInstance(): AIClient {
    if (!aiClientInstance) {
      throw new Error(
        'AIClient not initialized. Call AIClient.initialize() first.'
      )
    }
    return aiClientInstance
  }

  /**
   * Reset the instance (useful for testing or config changes)
   */
  static reset(): void {
    aiClientInstance = null
  }

  /**
   * Generate a complete AI response
   */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    return this.provider.generateResponse(request)
  }

  /**
   * Generate a streaming AI response
   */
  async *generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    yield* this.provider.generateStreamResponse(request)
  }

  /**
   * Check if the AI provider is available
   */
  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable()
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.providerName
  }

  /**
   * Helper: Simple text completion
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.generateResponse({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt,
    })
    return response.content
  }

  /**
   * Helper: Structured JSON response
   * Prompts the AI to return valid JSON
   */
  async generateJSON<T = any>(
    prompt: string,
    systemPrompt?: string
  ): Promise<T> {
    const enhancedSystemPrompt = `${systemPrompt || ''}\n\nIMPORTANT: Your response MUST be valid JSON only. Do not include any explanatory text before or after the JSON.`

    const response = await this.complete(prompt, enhancedSystemPrompt)

    try {
      // Try to extract JSON from response (in case of wrapping text)
      const jsonMatch = response.match(/\{[\s\S]*\}/)||response.match(/\[[\s\S]*\]/)
      const jsonString = jsonMatch ? jsonMatch[0] : response

      return JSON.parse(jsonString) as T
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${error}\nResponse: ${response}`
      )
    }
  }

  /**
   * Helper: Chat-style interaction
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const response = await this.generateResponse({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      systemPrompt,
    })
    return response.content
  }
}

/**
 * Helper function to get AI client instance
 */
export function getAIClient(): AIClient {
  return AIClient.getInstance()
}

/**
 * Helper function to initialize AI client
 */
export function initializeAI(config?: AIProviderConfig): AIClient {
  return AIClient.initialize(config)
}
