/**
 * AI Prompts for Vehicle Recommendations
 */

export const RECOMMENDATION_SYSTEM_PROMPT = `You are an expert automotive sales consultant AI for Ibticar.AI, a vehicle dealership platform in Algeria.

Your role is to analyze customer profiles, preferences, and available vehicle inventory to provide personalized vehicle recommendations.

Key considerations:
- Algerian market specificities (fuel availability, road conditions, climate)
- Customer budget constraints
- Practical needs (family size, usage type, terrain)
- Total cost of ownership (fuel consumption, maintenance, parts availability)
- Resale value in the Algerian market

You must provide recommendations in a structured JSON format with clear reasoning.`

export function buildRecommendationPrompt(params: {
  customer: {
    id: string
    email?: string
    type?: string
    preferences?: any
    previousPurchases?: any[]
  }
  vehicles: Array<{
    id: string
    brand: string
    model: string
    year: number
    price: number
    mileage: number
    fuelType: string
    transmission: string
    condition: string
    features?: string[]
  }>
  budget?: number
  requirements?: {
    bodyType?: string
    fuelType?: string
    transmission?: string
    minSeats?: number
    maxMileage?: number
    usage?: string
  }
}): string {
  return `Analyze the following customer profile and vehicle inventory to provide top 3 vehicle recommendations.

**Customer Profile:**
- ID: ${params.customer.id}
- Email: ${params.customer.email || 'N/A'}
- Type: ${params.customer.type || 'Individual'}
- Budget: ${params.budget ? `${params.budget.toLocaleString()} DZD` : 'Not specified'}
${params.customer.preferences ? `- Preferences: ${JSON.stringify(params.customer.preferences)}` : ''}
${params.customer.previousPurchases?.length ? `- Previous purchases: ${params.customer.previousPurchases.length} vehicle(s)` : ''}

**Requirements:**
${params.requirements ? `
- Body Type: ${params.requirements.bodyType || 'Any'}
- Fuel Type: ${params.requirements.fuelType || 'Any'}
- Transmission: ${params.requirements.transmission || 'Any'}
- Minimum Seats: ${params.requirements.minSeats || 'N/A'}
- Maximum Mileage: ${params.requirements.maxMileage ? `${params.requirements.maxMileage.toLocaleString()} km` : 'N/A'}
- Usage: ${params.requirements.usage || 'General'}
` : 'No specific requirements'}

**Available Vehicles (${params.vehicles.length} total):**
${params.vehicles
  .slice(0, 50) // Limit to prevent token overflow
  .map(
    (v, idx) => `
${idx + 1}. ${v.brand} ${v.model} (${v.year})
   - ID: ${v.id}
   - Price: ${v.price.toLocaleString()} DZD
   - Mileage: ${v.mileage.toLocaleString()} km
   - Fuel: ${v.fuelType}
   - Transmission: ${v.transmission}
   - Condition: ${v.condition}
   ${v.features?.length ? `- Features: ${v.features.join(', ')}` : ''}`
  )
  .join('\n')}

Provide your response as a JSON object with this exact structure:
{
  "recommendations": [
    {
      "vehicleId": "vehicle-id",
      "score": 85,
      "reasoning": "Clear explanation of why this vehicle matches the customer",
      "matchedPreferences": ["budget-friendly", "fuel-efficient", "reliable"],
      "potentialConcerns": ["higher mileage", "manual transmission"]
    }
  ],
  "explanation": "Overall recommendation strategy and advice for the customer",
  "generatedAt": "${new Date().toISOString()}"
}

Return ONLY the JSON object, no additional text.`
}
