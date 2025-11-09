/**
 * AI Prompts for Vehicle Rotation Predictions
 */

export const ROTATION_SYSTEM_PROMPT = `You are an expert automotive inventory analyst AI for Ibticar.AI, a vehicle dealership platform in Algeria.

Your role is to predict vehicle inventory turnover time (rotation) by analyzing vehicle characteristics, market conditions, and historical sales data.

Key factors to consider:
- Algerian market demand patterns (seasonal trends, popular brands, fuel preferences)
- Vehicle condition and pricing relative to market value
- Historical sales data for similar vehicles
- Economic indicators affecting purchasing power
- Regional preferences (urban vs rural, climate considerations)
- Parts availability and maintenance costs
- Resale value trends

You must provide predictions in a structured JSON format with clear reasoning and actionable recommendations.`

export function buildRotationPrompt(params: {
  vehicle: {
    id: string
    brand: string
    model: string
    year: number
    price: number
    mileage: number
    condition: string
    fuelType: string
    transmission: string
    bodyType?: string
    features?: string[]
    daysInInventory?: number
  }
  historicalData?: {
    similarVehicles: Array<{
      brand: string
      model: string
      year: number
      price: number
      daysSold: number
      soldDate: string
    }>
    averageRotationDays?: number
    fastestRotation?: number
    slowestRotation?: number
  }
  marketConditions?: {
    currentSeason?: string
    economicIndicators?: string
    competitorPricing?: string
    demandLevel?: 'low' | 'medium' | 'high'
  }
}): string {
  return `Analyze the following vehicle and predict how many days it will take to sell from the current date.

**Vehicle Details:**
- ID: ${params.vehicle.id}
- Brand: ${params.vehicle.brand}
- Model: ${params.vehicle.model}
- Year: ${params.vehicle.year}
- Price: ${params.vehicle.price.toLocaleString()} DZD
- Mileage: ${params.vehicle.mileage.toLocaleString()} km
- Condition: ${params.vehicle.condition}
- Fuel Type: ${params.vehicle.fuelType}
- Transmission: ${params.vehicle.transmission}
${params.vehicle.bodyType ? `- Body Type: ${params.vehicle.bodyType}` : ''}
${params.vehicle.features?.length ? `- Features: ${params.vehicle.features.join(', ')}` : ''}
${params.vehicle.daysInInventory ? `- Days in Inventory: ${params.vehicle.daysInInventory}` : ''}

**Historical Sales Data:**
${params.historicalData?.similarVehicles.length ? `
${params.historicalData.similarVehicles.length} similar vehicles sold:
${params.historicalData.similarVehicles
  .slice(0, 10) // Limit to prevent token overflow
  .map(
    (v, idx) => `
${idx + 1}. ${v.brand} ${v.model} (${v.year}) - ${v.price.toLocaleString()} DZD
   - Sold in ${v.daysSold} days (Date: ${v.soldDate})`
  )
  .join('\n')}

Average rotation: ${params.historicalData.averageRotationDays || 'N/A'} days
Fastest sale: ${params.historicalData.fastestRotation || 'N/A'} days
Slowest sale: ${params.historicalData.slowestRotation || 'N/A'} days
` : 'No historical data available for similar vehicles.'}

**Market Conditions:**
${params.marketConditions ? `
- Current Season: ${params.marketConditions.currentSeason || 'N/A'}
- Economic Indicators: ${params.marketConditions.economicIndicators || 'N/A'}
- Competitor Pricing: ${params.marketConditions.competitorPricing || 'N/A'}
- Demand Level: ${params.marketConditions.demandLevel || 'medium'}
` : 'No market condition data available.'}

Provide your prediction as a JSON object with this exact structure:
{
  "vehicleId": "${params.vehicle.id}",
  "predictedDays": 30,
  "confidence": 0.75,
  "riskLevel": "medium",
  "reasoning": "Detailed explanation of why this vehicle will take this amount of time to sell",
  "influencingFactors": {
    "positive": ["Popular brand in Algeria", "Competitive pricing", "Low mileage"],
    "negative": ["High fuel consumption", "Manual transmission less popular", "Peak selling season passed"]
  },
  "recommendations": [
    "Consider reducing price by 5% to accelerate sale",
    "Highlight fuel efficiency in marketing",
    "Target family buyers through social media campaigns"
  ],
  "priceAdjustmentSuggestion": {
    "currentPrice": ${params.vehicle.price},
    "suggestedPrice": ${params.vehicle.price * 0.95},
    "expectedImpact": "Could reduce sale time by 10-15 days"
  },
  "comparisonToMarket": "Below/At/Above market average",
  "generatedAt": "${new Date().toISOString()}"
}

IMPORTANT:
- predictedDays should be a realistic number based on historical data and market conditions
- confidence should be between 0 and 1 (0.5 = 50% confidence)
- riskLevel should be "low" (will sell quickly), "medium" (normal timeframe), or "high" (may take long time)
- Consider Algerian market specifics (fuel availability, popular brands, economic situation)

Return ONLY the JSON object, no additional text.`
}
