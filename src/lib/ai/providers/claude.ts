/**
 * Claude AI Provider
 * Implements IAIProvider interface for Anthropic Claude API
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  IAIProvider,
} from '../types'
import { AIProviderError, AIQuotaExceededError } from '../types'

export class ClaudeProvider implements IAIProvider {
  private client: Anthropic
  private model: string
  private defaultTemperature: number
  private defaultMaxTokens: number

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Claude API key is required')
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
    })

    this.model = config.model || 'claude-3-5-sonnet-20241022'
    this.defaultTemperature = config.temperature || 0.7
    this.defaultMaxTokens = config.maxTokens || 4096
  }

  /**
   * Generate a complete response from Claude
   */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role === 'system' ? ('user' as const) : msg.role,
        content: msg.content,
      }))

      // Extract system messages
      const systemMessages = request.messages
        .filter((msg) => msg.role === 'system')
        .map((msg) => msg.content)
        .join('\n\n')

      const systemPrompt = request.systemPrompt || systemMessages || undefined

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature || this.defaultTemperature,
        system: systemPrompt,
        messages: messages.filter((msg) => msg.role !== 'system'),
      })

      // Extract text content from response
      const content =
        response.content
          .filter((block) => block.type === 'text')
          .map((block) => (block as { type: 'text'; text: string }).text)
          .join('\n') || ''

      return {
        content,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        finishReason: response.stop_reason || undefined,
      }
    } catch (error: any) {
      if (error.status === 429) {
        throw new AIQuotaExceededError('claude')
      }

      throw new AIProviderError(
        `Claude API error: ${error.message}`,
        'claude',
        error
      )
    }
  }

  /**
   * Generate a streaming response from Claude
   */
  async *generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role === 'system' ? ('user' as const) : msg.role,
        content: msg.content,
      }))

      // Extract system messages
      const systemMessages = request.messages
        .filter((msg) => msg.role === 'system')
        .map((msg) => msg.content)
        .join('\n\n')

      const systemPrompt = request.systemPrompt || systemMessages || undefined

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || this.defaultMaxTokens,
        temperature: request.temperature || this.defaultTemperature,
        system: systemPrompt,
        messages: messages.filter((msg) => msg.role !== 'system'),
        stream: true,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              content: event.delta.text,
              done: false,
            }
          }
        } else if (event.type === 'message_stop') {
          yield {
            content: '',
            done: true,
          }
        }
      }
    } catch (error: any) {
      if (error.status === 429) {
        throw new AIQuotaExceededError('claude')
      }

      throw new AIProviderError(
        `Claude streaming error: ${error.message}`,
        'claude',
        error
      )
    }
  }

  /**
   * Check if Claude API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple availability check - try to create a minimal message
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      })
      return true
    } catch (error) {
      console.error('Claude API unavailable:', error)
      return false
    }
  }
}
