/**
 * Local AI Provider (Template)
 * Implements IAIProvider interface for locally hosted models
 * Supports: Ollama, vLLM, LM Studio, or custom inference servers
 */

import type {
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  IAIProvider,
} from '../types'
import { AIProviderError, AIModelUnavailableError } from '../types'

export class LocalProvider implements IAIProvider {
  private baseUrl: string
  private model: string
  private defaultTemperature: number
  private defaultMaxTokens: number

  constructor(config: AIProviderConfig) {
    // Default to Ollama API format (http://localhost:11434)
    this.baseUrl = config.baseUrl || 'http://localhost:11434/api'
    this.model = config.model || 'mistral'
    this.defaultTemperature = config.temperature || 0.7
    this.defaultMaxTokens = config.maxTokens || 4096
  }

  /**
   * Generate a complete response from local model
   * Uses Ollama API format as default (compatible with many local inference servers)
   */
  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      // Build prompt from messages
      const prompt = this.buildPrompt(request)

      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          temperature: request.temperature || this.defaultTemperature,
          options: {
            num_predict: request.maxTokens || this.defaultMaxTokens,
          },
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      return {
        content: data.response || '',
        model: this.model,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
        },
        finishReason: data.done ? 'stop' : undefined,
      }
    } catch (error: any) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new AIModelUnavailableError('local', this.model)
      }

      throw new AIProviderError(
        `Local model error: ${error.message}`,
        'local',
        error
      )
    }
  }

  /**
   * Generate a streaming response from local model
   */
  async *generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    try {
      const prompt = this.buildPrompt(request)

      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          temperature: request.temperature || this.defaultTemperature,
          options: {
            num_predict: request.maxTokens || this.defaultMaxTokens,
          },
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          yield { content: '', done: true }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)
              if (data.response) {
                yield {
                  content: data.response,
                  done: data.done || false,
                }
              }
              if (data.done) {
                yield { content: '', done: true }
                return
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error: any) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new AIModelUnavailableError('local', this.model)
      }

      throw new AIProviderError(
        `Local streaming error: ${error.message}`,
        'local',
        error
      )
    }
  }

  /**
   * Check if local model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama/local server is running
      const response = await fetch(`${this.baseUrl}/tags`, {
        method: 'GET',
      })
      return response.ok
    } catch (error) {
      console.error('Local AI server unavailable:', error)
      return false
    }
  }

  /**
   * Build prompt from messages
   * Converts structured messages to a single prompt string
   */
  private buildPrompt(request: AIRequest): string {
    const parts: string[] = []

    if (request.systemPrompt) {
      parts.push(`System: ${request.systemPrompt}\n`)
    }

    for (const message of request.messages) {
      if (message.role === 'system') {
        parts.push(`System: ${message.content}\n`)
      } else if (message.role === 'user') {
        parts.push(`User: ${message.content}\n`)
      } else if (message.role === 'assistant') {
        parts.push(`Assistant: ${message.content}\n`)
      }
    }

    parts.push('Assistant:')

    return parts.join('\n')
  }
}

/**
 * Alternative: vLLM Provider
 * For production-grade local inference with OpenAI-compatible API
 */
export class VLLMProvider implements IAIProvider {
  private baseUrl: string
  private model: string
  private defaultTemperature: number
  private defaultMaxTokens: number

  constructor(config: AIProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:8000/v1'
    this.model = config.model || 'mistralai/Mistral-7B-Instruct-v0.2'
    this.defaultTemperature = config.temperature || 0.7
    this.defaultMaxTokens = config.maxTokens || 4096
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature || this.defaultTemperature,
          max_tokens: request.maxTokens || this.defaultMaxTokens,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      return {
        content: message?.content || '',
        model: this.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        finishReason: data.choices[0]?.finish_reason,
      }
    } catch (error: any) {
      throw new AIProviderError(
        `vLLM error: ${error.message}`,
        'local',
        error
      )
    }
  }

  async *generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    // Similar implementation to Ollama but using OpenAI-compatible streaming
    throw new Error('Streaming not yet implemented for vLLM')
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`)
      return response.ok
    } catch (error) {
      return false
    }
  }
}
