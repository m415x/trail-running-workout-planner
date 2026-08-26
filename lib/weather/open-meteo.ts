//TODO Configurar SAT con SMN
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red'
export type AlertPhenomenon = 'wind' | 'zonda' | 'storm' | 'rain' | 'snow' | 'heat' | 'cold'

export interface WeatherAlert {
  level: AlertLevel
  phenomenon: AlertPhenomenon
  title: string
  description?: string
  source: 'smn' | 'estimated'
  validFrom?: string
  validTo?: string
}

export interface WeatherData {
  tempMax: number
  tempMin: number
  currentTemp?: number

  windSpeed: number
  windGusts: number
  windDirectionDeg: number
  windDirectionCardinal: string

  precipitationProb: number
  snowfallSum: number

  weatherCode: number
  conditionLabel: string

  isFavorableForRunning: boolean

  alerts?: WeatherAlert[]
}

// Convierte grados a puntos cardinales
export function getWindCardinal(deg: number): string {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSO',
    'SO',
    'OSO',
    'O',
    'ONO',
    'NO',
    'NNO',
  ]
  const index = Math.round(deg / 22.5) % 16
  return directions[index] ?? 'N'
}

// Interpreta el código WMO de la OMM (Organización Meteorológica Mundial)
export function interpretWmoCode(code: number): {
  label: string
  iconType: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm' | 'snow'
} {
  switch (code) {
    case 0:
      return { label: 'Despejado', iconType: 'sun' }
    case 1:
    case 2:
      return { label: 'Parcialmente nublado', iconType: 'cloud-sun' }
    case 3:
      return { label: 'Nublado', iconType: 'cloud' }
    case 45:
    case 48:
      return { label: 'Niebla / Neblina', iconType: 'cloud' }
    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return { label: 'Lluvia', iconType: 'rain' }
    case 71:
    case 73:
    case 75:
    case 85:
    case 86:
      return { label: 'Nieve', iconType: 'snow' }
    case 95:
    case 96:
    case 99:
      return { label: 'Tormenta eléctrica', iconType: 'storm' }
    default:
      return { label: 'Soleado', iconType: 'sun' }
  }
}

// Fetch a Open-Meteo (Por defecto San Juan / Cuyo, Argentina o parametrizable)
export async function fetchDailyWeather(
  lat: number = -31.529822,
  lon: number = -68.5440881,
  dateIso?: string, // YYYY-MM-DD
): Promise<WeatherData | null> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),

      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'precipitation_probability_max',
        'snowfall_sum',
      ].join(','),

      timezone: 'America/Argentina/San_Juan',
    })

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

    const res = await fetch(url, {
      next: { revalidate: 3600 },
    }) // Cache de 1 hora
    if (!res.ok) {
      console.error(`Open-Meteo error: ${res.status} ${res.statusText}`)

      return null
    }

    const data = await res.json()
    const daily = data.daily

    if (!daily || !daily.time || daily.time.length === 0) return null

    // Buscar el índice de la fecha solicitada
    // o tomar el día de hoy (índice 0)
    let idx = 0

    if (dateIso) {
      const foundIdx = daily.time.findIndex((t: string) => t === dateIso)
      if (foundIdx !== -1) idx = foundIdx
    }

    const tempMax = Math.round(daily.temperature_2m_max[idx] ?? 20)

    const tempMin = Math.round(daily.temperature_2m_min[idx] ?? 10)

    const windSpeed = Math.round(daily.wind_speed_10m_max[idx] ?? 0)

    const windGusts = Math.round(daily.wind_gusts_10m_max[idx] ?? 0)

    const windDirectionDeg = daily.wind_direction_10m_dominant[idx] ?? 0

    const windDirectionCardinal = getWindCardinal(windDirectionDeg)

    const precipitationProb = daily.precipitation_probability_max[idx] ?? 0

    const snowfallSum = Number((daily.snowfall_sum?.[idx] ?? 0).toFixed(1))

    const weatherCode = daily.weather_code[idx] ?? 0

    const conditionLabel = interpretWmoCode(weatherCode).label

    const isFavorableForRunning = windSpeed < 35 && windGusts < 50 && weatherCode < 60

    return {
      tempMax,
      tempMin,
      windSpeed,
      windGusts,
      windDirectionDeg,
      windDirectionCardinal,
      precipitationProb,
      snowfallSum,
      weatherCode,
      conditionLabel,
      isFavorableForRunning,
    }
  } catch (error) {
    console.error('Error fetching weather from Open-Meteo:', error)

    return null
  }
}
