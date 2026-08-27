import { WeatherData } from '@/types'
import { interpretWmoCode } from '@/service/weather/open-meteo'

export function useWeatherPillStrip(weather: WeatherData) {
  const { condition, label } = interpretWmoCode(weather.weatherCode)

  const windSpeed = weather.windSpeed
  const duration = windSpeed > 0 ? parseFloat((50 / windSpeed).toFixed(2)) : 0

  const isSnowCondition = condition === 'snow' || weather.snowfallSum > 0

  return {
    condition,
    label,
    duration,
    isSnowCondition,
  }
}
