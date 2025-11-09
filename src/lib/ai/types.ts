/**
 * AI Provider Types and Interfaces
 * Unified interface for different AI providers (Claude API, Local Models, etc.)
 */

// Base AI Provider Configuration
export interface AIProviderConfig {
  provider: 'claude' | 'local' | 'openai'
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

// AI Request/Response Types
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  systemPrompt?: string
}

export interface AIResponse {
  content: string
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  finishReason?: string
}

export interface AIStreamChunk {
  content: string
  done: boolean
}

// AI Provider Interface
export interface IAIProvider {
  generateResponse(request: AIRequest): Promise<AIResponse>
  generateStreamResponse(
    request: AIRequest
  ): AsyncGenerator<AIStreamChunk, void, unknown>
  isAvailable(): Promise<boolean>
}

// Business-specific AI types

// Vehicle Recommendation
export interface VehicleRecommendationRequest {
  customerId: string
  budget?: number
  preferences?: {
    bodyType?: string
    fuelType?: string
    transmission?: string
    minSeats?: number
    maxMileage?: number
  }
  previousInteractions?: string[]
}

export interface VehicleRecommendation {
  vehicleId: string
  score: number // 0-100
  reasoning: string
  matchedPreferences: string[]
  potentialConcerns?: string[]
}

export interface RecommendationResponse {
  recommendations: VehicleRecommendation[]
  explanation: string
  generatedAt: Date
}

// Rotation Prediction
export interface RotationPredictionRequest {
  vehicleId: string
  historicalData?: {
    averageDaysInStock?: number
    seasonalTrends?: Record<string, number>
    similarVehiclesRotation?: number[]
  }
  includeMarketAnalysis?: boolean
}

export interface RotationPrediction {
  vehicleId: string
  predictedDaysToSell: number
  confidence: number // 0-1
  factors: {
    positive: string[]
    negative: string[]
  }
  recommendations: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

// Dynamic Pricing
export interface DynamicPricingRequest {
  vehicleId: string
  currentPrice?: number
  marketData?: {
    averageMarketPrice?: number
    competitorPrices?: number[]
    demandLevel?: 'low' | 'medium' | 'high'
  }
  daysInStock?: number
  targetMargin?: number
  includeMarketAnalysis?: boolean
  businessObjectives?: string
}

export interface DynamicPricingRecommendation {
  vehicleId: string
  currentPrice: number
  recommendedPrice: number
  priceChange: number
  priceChangePercentage: number
  reasoning: string
  expectedImpact: {
    onSaleSpeed: string
    onMargin: string
  }
  confidence: number // 0-1
}

// AI Error Types
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export class AIQuotaExceededError extends AIProviderError {
  constructor(provider: string) {
    super('AI API quota exceeded', provider)
    this.name = 'AIQuotaExceededError'
  }
}

export class AIModelUnavailableError extends AIProviderError {
  constructor(provider: string, model: string) {
    super(`AI model ${model} is unavailable`, provider)
    this.name = 'AIModelUnavailableError'
  }
}
