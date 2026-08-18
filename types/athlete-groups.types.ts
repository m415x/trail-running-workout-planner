export type AthleteCategoryCode = 'E' | 'U' | 'M' | 'H' | 'S' | 'B'
export type AthleteLevelCode = '1' | '2' | '3'

// Genera automáticamente: 'E1' | 'E2' | 'E3' | 'U1' ... | 'B3' (18 grupos)
export type AthleteGroupCode = `${AthleteCategoryCode}${AthleteLevelCode}`

export interface CategoryMetadata {
  name: string
  code: AthleteCategoryCode
  description: string
}

export interface LevelMetadata {
  name: string
  code: AthleteLevelCode
  description: string
}

export const ATHLETE_CATEGORIES: Record<AthleteCategoryCode, CategoryMetadata> = {
  E: { name: 'Elite', code: 'E', description: 'Atletas de alto rendimiento y competencia' },
  U: { name: 'Ultra', code: 'U', description: 'Distancias superiores a 42k y ultras de montaña' },
  M: { name: 'Marathon', code: 'M', description: 'Distancia 42k en calle o trail maratón' },
  H: { name: 'Half-Marathon', code: 'H', description: 'Medio maratón (21k)' },
  S: { name: 'Short', code: 'S', description: 'Distancias cortas y explosivas (5k a 15k)' },
  B: { name: 'Base', code: 'B', description: 'Iniciación, adaptación y acondicionamiento' },
}

export const ATHLETE_LEVELS: Record<AthleteLevelCode, LevelMetadata> = {
  1: { name: 'Advance', code: '1', description: 'Alto volumen y experiencia' },
  2: { name: 'Intermediate', code: '2', description: 'Volumen y carga moderada' },
  3: { name: 'Novice', code: '3', description: 'Volumen controlado y progresión técnica' },
}
