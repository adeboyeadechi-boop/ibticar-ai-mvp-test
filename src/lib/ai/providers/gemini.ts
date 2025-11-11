/**
 * Google Gemini AI Provider
 * Implements IAIProvider interface for Google AI Studio (Gemini API)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  IAIProvider,
} from '../types'
import { AIProviderError, AIQuotaExceededError } from '../types'

export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI
  private model: string
  private defaultTemperature: number
  private defaultMaxTokens: number

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Google AI Studio API key is required')
    }

    this.client = new GoogleGenerativeAI(config.apiKey)
    this.model = config.model || 'gemini-2.0-flash-exp'
    this.defaultTemperature = config.temperature || 0.7
    this.defaultMaxTokens = config.maxTokens || 4096
  }

  /**
   * Generate a complete response from Gemini
   */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: request.temperature || this.defaultTemperature,
          maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
        },
      })

      // Build the prompt from messages
      const prompt = this.buildPrompt(request)

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      return {
        content: text,
        model: this.model,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        },
        finishReason: response.candidates?.[0]?.finishReason || undefined,
      }
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        throw new AIQuotaExceededError('gemini')
      }

      throw new AIProviderError(
        `Gemini API error: ${error.message}`,
        'gemini',
        error
      )
    }
  }

  /**
   * Generate a streaming response from Gemini
   */
  async *generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: request.temperature || this.defaultTemperature,
          maxOutputTokens: request.maxTokens || this.defaultMaxTokens,
        },
      })

      const prompt = this.buildPrompt(request)

      const result = await model.generateContentStream(prompt)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          yield {
            content: text,
            done: false,
          }
        }
      }

      yield {
        content: '',
        done: true,
      }
    } catch (error: any) {
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        throw new AIQuotaExceededError('gemini')
      }

      throw new AIProviderError(
        `Gemini streaming error: ${error.message}`,
        'gemini',
        error
      )
    }
  }

  /**
   * Check if Gemini API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model })
      const result = await model.generateContent('test')
      await result.response
      return true
    } catch (error) {
      console.error('Gemini API unavailable:', error)
      return false
    }
  }

  /**
   * Build prompt from messages
   * Converts structured messages to Gemini format
   */
  private buildPrompt(request: AIRequest): string {
    const parts: string[] = []

    // Add system prompt if present
    if (request.systemPrompt) {
      parts.push(`Instructions: ${request.systemPrompt}\n`)
    }

    // Add system messages
    const systemMessages = request.messages
      .filter((msg) => msg.role === 'system')
      .map((msg) => msg.content)

    if (systemMessages.length > 0) {
      parts.push(`Instructions: ${systemMessages.join('\n')}\n`)
    }

    // Add conversation messages
    for (const message of request.messages) {
      if (message.role === 'user') {
        parts.push(`User: ${message.content}`)
      } else if (message.role === 'assistant') {
        parts.push(`Assistant: ${message.content}`)
      }
    }

    return parts.join('\n\n')
  }
}
