import type { WeatherCondition, WeatherData } from '@/types'

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

export interface WmoInterpretation {
  condition: WeatherCondition
  label: string
}

// Interpreta el código WMO de la OMM (Organización Meteorológica Mundial)
export function interpretWmoCode(code: number): WmoInterpretation {
  switch (code) {
    case 0:
      return {
        condition: 'clear',
        label: 'Despejado',
      }

    case 1:
      return {
        condition: 'partly-cloudy',
        label: 'Principalmente despejado',
      }

    case 2:
      return {
        condition: 'partly-cloudy',
        label: 'Parcialmente nublado',
      }

    case 3:
      return {
        condition: 'cloudy',
        label: 'Nublado',
      }

    case 45:
    case 48:
      return {
        condition: 'fog',
        label: 'Niebla / Neblina',
      }

    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 80:
    case 81:
      return {
        condition: 'rain',
        label: 'Lluvia',
      }

    case 65:
    case 82:
      return {
        condition: 'heavy-rain',
        label: 'Lluvia intensa',
      }

    case 71:
    case 73:
    case 75:
    case 85:
    case 86:
      return {
        condition: 'snow',
        label: 'Nieve',
      }

    case 95:
    case 96:
    case 99:
      return {
        condition: 'thunderstorm',
        label: 'Tormenta eléctrica',
      }

    default:
      return {
        condition: 'clear',
        label: 'Desconocido',
      }
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
        'apparent_temperature_max',
        'apparent_temperature_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'snowfall_sum',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'relative_humidity_2m_mean',
        'visibility_mean',
        'sunrise',
        'sunset',
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

    const interpretation = interpretWmoCode(weatherCode)

    const condition = interpretation.condition
    const conditionLabel = interpretation.label

    const apparentTempMax = Math.round(daily.apparent_temperature_max?.[idx] ?? tempMax)

    const apparentTempMin = Math.round(daily.apparent_temperature_min?.[idx] ?? tempMin)

    const precipitationSum = Number((daily.precipitation_sum?.[idx] ?? 0).toFixed(1))

    const humidity =
      daily.relative_humidity_2m_mean?.[idx] != null ? Math.round(daily.relative_humidity_2m_mean[idx]) : undefined

    const visibility = daily.visibility_mean?.[idx] != null ? Math.round(daily.visibility_mean[idx]) : undefined

    const sunrise = daily.sunrise?.[idx]
    const sunset = daily.sunset?.[idx]

    const isFoggy = condition === 'fog'
    const isThunderstorm = condition === 'thunderstorm'
    const isSnowing = condition === 'snow' || snowfallSum > 0

    const isFavorableForRunning =
      windSpeed < 35 &&
      windGusts < 50 &&
      !isThunderstorm &&
      !isSnowing &&
      condition !== 'heavy-rain' &&
      precipitationProb < 70

    return {
      tempMax,
      tempMin,

      apparentTempMax,
      apparentTempMin,

      windSpeed,
      windGusts,
      windDirectionDeg,
      windDirectionCardinal,

      precipitationSum,
      precipitationProb,

      snowfallSum,

      humidity,
      visibility,

      weatherCode,
      condition,
      conditionLabel,

      isFoggy,
      isThunderstorm,
      isSnowing,

      isFavorableForRunning,

      sun:
        sunrise && sunset
          ? {
              sunrise,
              sunset,
            }
          : undefined,
    }
  } catch (error) {
    console.error('Error fetching weather from Open-Meteo:', error)

    return null
  }
}
