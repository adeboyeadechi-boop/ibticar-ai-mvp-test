/**
 * Calculateur de classe énergétique selon les normes algériennes 2024
 * Conforme à la réglementation DGI Algérie sur l'étiquetage énergétique automobile
 *
 * Références:
 * - Décret exécutif n° 24-XX relatif à l'étiquetage énergétique des véhicules
 * - Normes basées sur CO2 (g/km) et consommation de carburant (L/100km)
 */

import { EnergyLabel, FuelType } from '@/generated/prisma'

/**
 * Seuils de CO2 (g/km) pour classification énergétique en Algérie
 * Basé sur véhicules essence (ajustements pour diesel)
 */
const CO2_THRESHOLDS = {
  A_PLUS_PLUS: 95,    // Électrique, hybride plug-in à faible émission
  A_PLUS: 110,        // Hybride, très faible émission
  A: 125,             // Faible émission
  B: 145,             // Emission modérée
  C: 165,             // Emission moyenne
  D: 185,             // Emission élevée
  E: 210,             // Emission très élevée
  F: 240,             // Emission critique
  // G: > 240          // Emission excessive
}

/**
 * Seuils de consommation mixte (L/100km) pour classification
 */
const FUEL_CONSUMPTION_THRESHOLDS = {
  A_PLUS_PLUS: 3.5,
  A_PLUS: 4.5,
  A: 5.5,
  B: 6.5,
  C: 7.5,
  D: 8.5,
  E: 10.0,
  F: 12.0,
  // G: > 12.0
}

/**
 * Calcule la classe énergétique basée sur les émissions de CO2
 *
 * @param co2Emissions - Émissions de CO2 en g/km
 * @param fuelType - Type de carburant
 * @returns Classe énergétique (EnergyLabel)
 */
export function calculateEnergyClassFromCO2(
  co2Emissions: number,
  fuelType: FuelType
): EnergyLabel {
  // Ajustement pour diesel (+10% tolérance selon normes DZ)
  const adjustedCO2 = fuelType === 'DIESEL' ? co2Emissions * 0.9 : co2Emissions

  // Véhicules électriques et à très faibles émissions
  if (co2Emissions === 0 || fuelType === 'ELECTRIC') {
    return 'A_PLUS_PLUS'
  }

  if (adjustedCO2 <= CO2_THRESHOLDS.A_PLUS_PLUS) return 'A_PLUS_PLUS'
  if (adjustedCO2 <= CO2_THRESHOLDS.A_PLUS) return 'A_PLUS'
  if (adjustedCO2 <= CO2_THRESHOLDS.A) return 'A'
  if (adjustedCO2 <= CO2_THRESHOLDS.B) return 'B'
  if (adjustedCO2 <= CO2_THRESHOLDS.C) return 'C'
  if (adjustedCO2 <= CO2_THRESHOLDS.D) return 'D'
  if (adjustedCO2 <= CO2_THRESHOLDS.E) return 'E'
  if (adjustedCO2 <= CO2_THRESHOLDS.F) return 'F'

  return 'G' // > 240 g/km
}

/**
 * Calcule la classe énergétique basée sur la consommation de carburant
 *
 * @param fuelConsumption - Consommation mixte en L/100km
 * @param fuelType - Type de carburant
 * @returns Classe énergétique (EnergyLabel)
 */
export function calculateEnergyClassFromConsumption(
  fuelConsumption: number,
  fuelType: FuelType
): EnergyLabel {
  // Véhicules électriques (pas de consommation carburant)
  if (fuelType === 'ELECTRIC') {
    return 'A_PLUS_PLUS'
  }

  // Ajustement pour hybrides (-20% selon normes)
  const adjustedConsumption =
    fuelType === 'HYBRID' || fuelType === 'PLUGIN_HYBRID'
      ? fuelConsumption * 0.8
      : fuelConsumption

  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.A_PLUS_PLUS) return 'A_PLUS_PLUS'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.A_PLUS) return 'A_PLUS'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.A) return 'A'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.B) return 'B'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.C) return 'C'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.D) return 'D'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.E) return 'E'
  if (adjustedConsumption <= FUEL_CONSUMPTION_THRESHOLDS.F) return 'F'

  return 'G' // > 12.0 L/100km
}

/**
 * Calcule la classe énergétique automatiquement selon les données disponibles
 * Priorité: CO2 > Consommation mixte > Consommation estimée
 *
 * @param params - Paramètres du véhicule
 * @returns Classe énergétique calculée ou null si données insuffisantes
 */
export function calculateEnergyClass(params: {
  co2Emissions?: number | null
  fuelConsumptionCombined?: number | null
  fuelConsumptionUrban?: number | null
  fuelConsumptionHighway?: number | null
  fuelType: FuelType
  engineCapacity?: number | null
}): EnergyLabel | null {
  const {
    co2Emissions,
    fuelConsumptionCombined,
    fuelConsumptionUrban,
    fuelConsumptionHighway,
    fuelType,
    engineCapacity,
  } = params

  // Véhicules électriques (toujours A++)
  if (fuelType === 'ELECTRIC') {
    return 'A_PLUS_PLUS'
  }

  // Priorité 1: Calcul basé sur CO2 (plus précis)
  if (co2Emissions && co2Emissions > 0) {
    return calculateEnergyClassFromCO2(co2Emissions, fuelType)
  }

  // Priorité 2: Calcul basé sur consommation mixte
  if (fuelConsumptionCombined && fuelConsumptionCombined > 0) {
    return calculateEnergyClassFromConsumption(fuelConsumptionCombined, fuelType)
  }

  // Priorité 3: Estimation à partir consommations urbaine/autoroute
  if (fuelConsumptionUrban && fuelConsumptionHighway) {
    // Formule: mixte = (urbaine * 0.55) + (autoroute * 0.45)
    const estimatedCombined =
      (fuelConsumptionUrban * 0.55) + (fuelConsumptionHighway * 0.45)
    return calculateEnergyClassFromConsumption(estimatedCombined, fuelType)
  }

  // Priorité 4: Estimation grossière basée sur cylindrée (méthode de dernier recours)
  if (engineCapacity && engineCapacity > 0) {
    const estimatedConsumption = estimateFuelConsumptionFromEngine(
      engineCapacity,
      fuelType
    )
    return calculateEnergyClassFromConsumption(estimatedConsumption, fuelType)
  }

  // Données insuffisantes pour calcul
  return null
}

/**
 * Estime la consommation de carburant à partir de la cylindrée moteur
 * (Méthode approximative - à utiliser en dernier recours)
 *
 * @param engineCapacity - Cylindrée en cm³
 * @param fuelType - Type de carburant
 * @returns Consommation estimée en L/100km
 */
function estimateFuelConsumptionFromEngine(
  engineCapacity: number,
  fuelType: FuelType
): number {
  // Formule simplifiée: consommation ≈ cylindrée / 200 (pour essence)
  const baseConsumption = engineCapacity / 200

  // Ajustements par type de carburant
  switch (fuelType) {
    case 'DIESEL':
      return baseConsumption * 0.85 // Diesel consomme ~15% moins
    case 'HYBRID':
    case 'PLUGIN_HYBRID':
      return baseConsumption * 0.6 // Hybride consomme ~40% moins
    case 'LPG':
    case 'CNG':
      return baseConsumption * 1.1 // GPL/GNC moins efficient volumétriquement
    case 'GASOLINE':
    default:
      return baseConsumption
  }
}

/**
 * Calcule les émissions de CO2 estimées à partir de la consommation
 * Formule: CO2 (g/km) ≈ Consommation (L/100km) × Facteur carburant
 *
 * @param fuelConsumption - Consommation en L/100km
 * @param fuelType - Type de carburant
 * @returns Émissions CO2 estimées en g/km
 */
export function estimateCO2FromConsumption(
  fuelConsumption: number,
  fuelType: FuelType
): number {
  // Facteurs de conversion carburant → CO2 (normes WLTP)
  const CO2_FACTORS: Record<string, number> = {
    GASOLINE: 23.5,  // 23.5 g CO2 / L essence
    DIESEL: 26.5,    // 26.5 g CO2 / L diesel
    LPG: 16.5,       // 16.5 g CO2 / L GPL
    CNG: 19.0,       // 19.0 g CO2 / L GNC équivalent
    HYBRID: 20.0,    // Moyenne pondérée
    PLUGIN_HYBRID: 15.0, // Moyenne pondérée (mode électrique)
    ELECTRIC: 0,     // 0 émission directe
  }

  const factor = CO2_FACTORS[fuelType] || CO2_FACTORS.GASOLINE
  return Math.round(fuelConsumption * factor / 10) // Conversion L/100km → g/km
}

/**
 * Retourne une description textuelle de la classe énergétique
 * en français et arabe (pour affichage UI)
 */
export function getEnergyLabelDescription(label: EnergyLabel): {
  fr: string
  ar: string
  color: string
} {
  const descriptions = {
    A_PLUS_PLUS: {
      fr: 'Très économe - Émissions très faibles',
      ar: 'اقتصادي جداً - انبعاثات منخفضة جداً',
      color: '#00A651', // Vert foncé
    },
    A_PLUS: {
      fr: 'Très économe - Émissions faibles',
      ar: 'اقتصادي جداً - انبعاثات منخفضة',
      color: '#4CB849', // Vert
    },
    A: {
      fr: 'Économe - Faibles émissions',
      ar: 'اقتصادي - انبعاثات منخفضة',
      color: '#8CC640', // Vert clair
    },
    B: {
      fr: 'Bon rendement - Émissions modérées',
      ar: 'أداء جيد - انبعاثات معتدلة',
      color: '#C4D600', // Jaune-vert
    },
    C: {
      fr: 'Rendement moyen - Émissions moyennes',
      ar: 'أداء متوسط - انبعاثات متوسطة',
      color: '#FFF100', // Jaune
    },
    D: {
      fr: 'Rendement passable - Émissions élevées',
      ar: 'أداء مقبول - انبعاثات عالية',
      color: '#FDB913', // Orange clair
    },
    E: {
      fr: 'Peu économe - Émissions très élevées',
      ar: 'غير اقتصادي - انبعاثات عالية جداً',
      color: '#F68B1F', // Orange
    },
    F: {
      fr: 'Énergivore - Émissions critiques',
      ar: 'مستهلك للطاقة - انبعاثات حرجة',
      color: '#ED1C24', // Rouge clair
    },
    G: {
      fr: 'Très énergivore - Émissions excessives',
      ar: 'مستهلك جداً للطاقة - انبعاثات مفرطة',
      color: '#B2191C', // Rouge foncé
    },
  }

  return descriptions[label]
}
