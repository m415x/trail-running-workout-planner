export interface WeatherData {
  tempMax: number
  tempMin: number
  currentTemp?: number
  windSpeed: number // km/h
  windDirectionDeg: number // 0-360°
  windDirectionCardinal: string // 'N', 'SO', 'E', etc.
  precipitationProb: number // %
  snowfallSum: number // cm (Nieve acumulada estimada)
  weatherCode: number
  conditionLabel: string
  isFavorableForRunning: boolean
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,snowfall_sum&timezone=America/Argentina/San_Juan`

    const res = await fetch(url, { next: { revalidate: 3600 } }) // Cache de 1 hora
    if (!res.ok) return null

    const data = await res.json()
    const daily = data.daily

    if (!daily || !daily.time || daily.time.length === 0) return null

    // Buscar el índice de la fecha solicitada o tomar el día de hoy (índice 0)
    let idx = 0
    if (dateIso) {
      const foundIdx = daily.time.findIndex((t: string) => t === dateIso)
      if (foundIdx !== -1) idx = foundIdx
    }

    const weatherCode = daily.weathercode[idx] ?? 0
    const windDeg = daily.winddirection_10m_dominant[idx] ?? 0
    const windSpeed = Math.round(daily.windspeed_10m_max[idx] ?? 0)
    const snowfallSum = Number((daily.snowfall_sum?.[idx] ?? 0).toFixed(1))

    return {
      tempMax: Math.round(daily.temperature_2m_max[idx] ?? 20),
      tempMin: Math.round(daily.temperature_2m_min[idx] ?? 10),
      windSpeed,
      windDirectionDeg: windDeg,
      windDirectionCardinal: getWindCardinal(windDeg),
      precipitationProb: daily.precipitation_probability_max[idx] ?? 0,
      snowfallSum,
      weatherCode,
      conditionLabel: interpretWmoCode(weatherCode).label,
      isFavorableForRunning: windSpeed < 35 && weatherCode < 60,
    }
  } catch (error) {
    console.error('Error fetching weather from Open-Meteo:', error)
    return null
  }
}
