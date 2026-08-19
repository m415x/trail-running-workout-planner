'use client'

import { Sun, CloudSun, Cloud, CloudRain, CloudLightning, Snowflake, Wind, Droplets } from 'lucide-react'
import { WeatherData, interpretWmoCode } from '@/lib/weather/open-meteo'
import { CustomCardInside } from '@/components/ui/custom/card-containers'

interface WeatherPillStripProps {
  weather: WeatherData | null
  isLoading?: boolean
}

function WeatherIcon({ iconType }: { iconType: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm' | 'snow' }) {
  switch (iconType) {
    case 'sun':
      return <Sun size={15} className='text-amber-500 shrink-0 animate-spin-slow' />
    case 'cloud-sun':
      return <CloudSun size={15} className='text-amber-400 shrink-0' />
    case 'cloud':
      return <Cloud size={15} className='text-sky-400 shrink-0' />
    case 'rain':
      return <CloudRain size={15} className='text-blue-400 shrink-0' />
    case 'storm':
      return <CloudLightning size={15} className='text-purple-400 shrink-0' />
    case 'snow':
      return <Snowflake size={15} className='text-cyan-300 shrink-0' />
  }
}

export function WeatherPillStrip({ weather, isLoading }: WeatherPillStripProps) {
  if (isLoading) {
    return (
      <CustomCardInside className='px-3 py-1.5 rounded-xl animate-pulse flex items-center justify-center text-[10px] text-muted-foreground'>
        Consultando condiciones meteorológicas...
      </CustomCardInside>
    )
  }

  if (!weather) return null

  const { iconType, label } = interpretWmoCode(weather.weatherCode)
  const isSnowCondition = iconType === 'snow' || weather.snowfallSum > 0

  return (
    <CustomCardInside className='flex justify-center rounded-xl px-0 py-0.5 gap-3'>
      {/* Estado del Tiempo + Temperaturas Max/Min */}
      <div className='flex flex-1 items-center justify-center gap-1.5'>
        <WeatherIcon iconType={iconType} />
        <span className='font-heading font-bold text-foreground text-[11px]'>
          {weather.tempMax}°<span className='font-normal text-muted-foreground ml-0.5'>/ {weather.tempMin}°</span>
        </span>
        <span className='text-[10px] text-muted-foreground hidden sm:inline'>· {label}</span>
      </div>

      {/* Viento y Dirección */}
      <div className='flex flex-1 items-center justify-center gap-1.5 text-foreground/90 font-mono'>
        <Wind size={12} className='text-muted-foreground' />
        <span className='font-heading font-bold text-foreground text-[11px]'>
          {weather.windSpeed}
          <span className='text-[10px] font-semibold pl-1'>km/h</span>
        </span>

        {/* Flecha de brújula rotando según los grados */}
        <span
          className='inline-flex items-center text-primary transition-transform duration-300 ml-0.5'
          style={{ transform: `rotate(${weather.windDirectionDeg}deg)` }}
          title={`Viento desde el ${weather.windDirectionCardinal} (${weather.windDirectionDeg}°)`}
        >
          ↑
        </span>
        <span className='text-[9px] font-bold text-muted-foreground'>{weather.windDirectionCardinal}</span>
      </div>

      {/* Alerta de Nieve (Si hay acumulación o código de nieve) */}
      {isSnowCondition ? (
        <div className='flex flex-1 items-center justify-center gap-1.5 text-cyan-500 font-mono'>
          <Snowflake size={12} />
          <span className='font-heading font-semibold text-[11px]'>
            {weather.snowfallSum > 0 ? `${weather.snowfallSum} cm` : `${weather.precipitationProb}%`}
          </span>
        </div>
      ) : (
        /* Probabilidad de Lluvia si supera el 10% */
        weather.precipitationProb > 10 && (
          <div className='flex flex-1 items-center justify-center gap-1.5 text-blue-500 font-mono'>
            <Droplets size={12} />
            <span className='font-heading font-semibold text-[11px]'>{weather.precipitationProb}%</span>
          </div>
        )
      )}
    </CustomCardInside>
  )
}
