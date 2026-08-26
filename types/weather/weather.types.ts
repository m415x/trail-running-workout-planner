//TODO Configurar SAT con SMN
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red'
export type AlertPhenomenon = 'wind' | 'zonda' | 'storm' | 'rain' | 'snow' | 'heat' | 'cold'

/**
 * Condiciones meteorológicas normalizadas de la aplicación.
 */
export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'sleet'
  | 'thunderstorm'
  | 'windy'

/**
 * Momento del día relevante para la planificación del entrenamiento.
 */
export interface SunTimes {
  sunrise: string
  sunset: string
}

/**
 * TODO Alertas meteorológicas.
 *
 * La dejamos preparada para una futura fuente de alertas.
 */
export interface WeatherAlert {
  id?: string
  title: string
  description?: string
  severity?: 'info' | 'warning' | 'danger'
  level: AlertLevel
  phenomenon: AlertPhenomenon
  startsAt?: string
  endsAt?: string
  source: 'smn' | 'estimated'
}

/**
 * Datos meteorológicos normalizados.
 *
 * Las unidades son explícitas:
 * - temperatura: °C
 * - viento: km/h
 * - precipitación: mm
 * - nieve: cm
 * - humedad: %
 * - visibilidad: metros
 * - dirección: grados meteorológicos (0-360)
 */
export interface WeatherData {
  /** Temperatura prevista en °C. */
  tempMax: number
  tempMin: number

  /** Sensación térmica en °C. */
  apparentTempMax?: number
  apparentTempMin?: number

  /** Temperatura actual o prevista para el momento relevante. */
  currentTemp?: number

  /** Velocidad máxima del viento en km/h. */
  windSpeed: number

  /** Rachas máximas de viento en km/h. */
  windGusts: number

  /** Dirección dominante del viento en grados (0-360). */
  windDirectionDeg: number

  /** Dirección cardinal normalizada: N, NE, E, etc. */
  windDirectionCardinal: string

  /** Precipitación acumulada en mm. */
  precipitationSum?: number

  /** Probabilidad máxima de precipitación en %. */
  precipitationProb: number

  /** Nieve acumulada en cm. */
  snowfallSum: number

  /** Humedad relativa en %. */
  humidity?: number

  /** Visibilidad en metros. */
  visibility?: number

  /** Código meteorológico WMO. */
  weatherCode: number

  /** Condición meteorológica normalizada. */
  condition: WeatherCondition

  /** Texto legible de la condición meteorológica. */
  conditionLabel?: string

  /** Indica si existen condiciones de niebla. */
  isFoggy: boolean

  /** Indica si existe riesgo de tormenta eléctrica. */
  isThunderstorm: boolean

  /** Indica si existe nieve. */
  isSnowing: boolean

  /** Evaluación general para la práctica de running. */
  isFavorableForRunning?: boolean

  /** Amanecer y atardecer. */
  sun?: {
    sunrise: string
    sunset: string
  }

  /** Alertas meteorológicas. */
  alerts?: WeatherAlert[]
}
