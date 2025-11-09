/**
 * AI Prompts for Dynamic Pricing Recommendations
 */

export const PRICING_SYSTEM_PROMPT = `You are an expert automotive pricing strategist AI for Ibticar.AI, a vehicle dealership platform in Algeria.

Your role is to recommend optimal pricing strategies by analyzing market conditions, competitor pricing, vehicle characteristics, and business objectives.

Key considerations:
- Algerian market dynamics (purchasing power, currency stability, import/export trends)
- Competitive pricing analysis
- Vehicle depreciation and condition assessment
- Inventory turnover objectives (balance between profit margin and rotation speed)
- Seasonal demand fluctuations
- Total cost of ownership perception
- Psychological pricing strategies for the Algerian market
- Economic indicators affecting vehicle affordability

You must provide pricing recommendations in a structured JSON format with clear justification and multiple pricing scenarios.`

export function buildPricingPrompt(params: {
  vehicle: {
    id: string
    brand: string
    model: string
    year: number
    currentPrice: number
    purchasePrice?: number
    mileage: number
    condition: string
    fuelType: string
    transmission: string
    bodyType?: string
    features?: string[]
    daysInInventory: number
  }
  marketData?: {
    similarVehicles: Array<{
      brand: string
      model: string
      year: number
      price: number
      mileage: number
      status: string
      daysListed?: number
    }>
    averageMarketPrice?: number
    priceRange?: {
      min: number
      max: number
    }
  }
  businessObjectives?: {
    targetMargin?: number
    urgencyLevel?: 'low' | 'medium' | 'high'
    targetRotationDays?: number
    minimumAcceptablePrice?: number
  }
}): string {
  const profitMargin =
    params.vehicle.purchasePrice && params.vehicle.currentPrice
      ? (
          ((params.vehicle.currentPrice - params.vehicle.purchasePrice) /
            params.vehicle.purchasePrice) *
          100
        ).toFixed(2)
      : 'N/A'

  return `Analyze the following vehicle and market data to recommend optimal pricing strategies.

**Vehicle Details:**
- ID: ${params.vehicle.id}
- Brand: ${params.vehicle.brand}
- Model: ${params.vehicle.model}
- Year: ${params.vehicle.year}
- Current Price: ${params.vehicle.currentPrice.toLocaleString()} DZD
${params.vehicle.purchasePrice ? `- Purchase Price: ${params.vehicle.purchasePrice.toLocaleString()} DZD` : ''}
${params.vehicle.purchasePrice ? `- Current Profit Margin: ${profitMargin}%` : ''}
- Mileage: ${params.vehicle.mileage.toLocaleString()} km
- Condition: ${params.vehicle.condition}
- Fuel Type: ${params.vehicle.fuelType}
- Transmission: ${params.vehicle.transmission}
${params.vehicle.bodyType ? `- Body Type: ${params.vehicle.bodyType}` : ''}
${params.vehicle.features?.length ? `- Features: ${params.vehicle.features.join(', ')}` : ''}
- Days in Inventory: ${params.vehicle.daysInInventory}

**Market Analysis:**
${params.marketData?.similarVehicles.length ? `
${params.marketData.similarVehicles.length} similar vehicles found in market:
${params.marketData.similarVehicles
  .slice(0, 10)
  .map(
    (v, idx) => `
${idx + 1}. ${v.brand} ${v.model} (${v.year}) - ${v.price.toLocaleString()} DZD
   - Mileage: ${v.mileage.toLocaleString()} km
   - Status: ${v.status}
   ${v.daysListed ? `- Listed for ${v.daysListed} days` : ''}`
  )
  .join('\n')}

Average Market Price: ${params.marketData.averageMarketPrice ? `${params.marketData.averageMarketPrice.toLocaleString()} DZD` : 'N/A'}
${params.marketData.priceRange ? `Price Range: ${params.marketData.priceRange.min.toLocaleString()} - ${params.marketData.priceRange.max.toLocaleString()} DZD` : ''}
` : 'Limited market data available.'}

**Business Objectives:**
${params.businessObjectives ? `
- Target Profit Margin: ${params.businessObjectives.targetMargin ? `${params.businessObjectives.targetMargin}%` : 'N/A'}
- Urgency Level: ${params.businessObjectives.urgencyLevel || 'medium'}
- Target Rotation: ${params.businessObjectives.targetRotationDays ? `${params.businessObjectives.targetRotationDays} days` : 'N/A'}
${params.businessObjectives.minimumAcceptablePrice ? `- Minimum Acceptable Price: ${params.businessObjectives.minimumAcceptablePrice.toLocaleString()} DZD` : ''}
` : 'No specific business objectives provided.'}

Provide your pricing recommendation as a JSON object with this exact structure:
{
  "vehicleId": "${params.vehicle.id}",
  "currentPrice": ${params.vehicle.currentPrice},
  "recommendations": {
    "optimal": {
      "price": 2500000,
      "reasoning": "Balanced approach for best margin with reasonable rotation",
      "expectedDaysToSell": 30,
      "profitMargin": 15.5,
      "confidence": 0.8
    },
    "quick_sale": {
      "price": 2300000,
      "reasoning": "Aggressive pricing to sell within 2 weeks",
      "expectedDaysToSell": 14,
      "profitMargin": 10.2,
      "confidence": 0.9
    },
    "maximum_profit": {
      "price": 2800000,
      "reasoning": "Premium positioning for patient seller",
      "expectedDaysToSell": 60,
      "profitMargin": 22.0,
      "confidence": 0.6
    }
  },
  "marketPosition": {
    "currentPosition": "Above/Below/At market average",
    "competitiveAdvantage": ["Lower mileage than average", "Premium features"],
    "competitiveDisadvantage": ["Older model year", "Manual transmission"],
    "pricePercentile": 65
  },
  "adjustmentRecommendation": {
    "action": "reduce/maintain/increase",
    "amount": -50000,
    "percentage": -2.0,
    "urgency": "medium",
    "reasoning": "Vehicle priced above market average with increasing inventory time"
  },
  "pricingStrategy": {
    "primary": "Value-based pricing strategy recommended",
    "tactics": [
      "Highlight fuel efficiency to justify premium",
      "Bundle extended warranty to add perceived value",
      "Offer trade-in incentives to overcome price sensitivity"
    ],
    "timing": "Consider price adjustment within next 7 days if no serious inquiries"
  },
  "riskAnalysis": {
    "overpricing": {
      "risk": "medium",
      "impact": "May remain in inventory 30+ additional days"
    },
    "underpricing": {
      "risk": "low",
      "impact": "Potential 100,000 DZD profit loss"
    }
  },
  "generatedAt": "${new Date().toISOString()}"
}

IMPORTANT:
- All prices should be realistic for the Algerian market (in DZD)
- Consider purchasing power and economic conditions in Algeria
- Factor in vehicle depreciation and market demand
- Provide at least 3 pricing scenarios (optimal, quick_sale, maximum_profit)
- Confidence should be between 0 and 1
- Consider psychological pricing (ending in 0000 or 5000 for Algerian market)

Return ONLY the JSON object, no additional text.`
}
