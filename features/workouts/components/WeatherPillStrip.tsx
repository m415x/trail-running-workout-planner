'use client'

import { DropIcon, ArrowCircleDownIcon } from '@phosphor-icons/react'
import { WeatherIcon, WindIcon, GustIcon } from '@icons'
import { WeatherData } from '@/types'
import { useWeatherPillStrip } from '@workouts/hooks/useWeatherPillStrip'
import { CustomCardInside } from '@ui/custom/card-containers'
import { IconBrandSnowflake } from '@tabler/icons-react'

export interface WeatherPillStripProps {
  weather: WeatherData | null
  isLoading?: boolean
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

  const { condition, duration, isSnowCondition } = useWeatherPillStrip(weather)

  return (
    <CustomCardInside className='flex justify-center rounded-xl px-0 py-2 gap-3'>
      {/* Estado del tiempo + temperaturas */}
      <div className='flex flex-1 items-center justify-center gap-1'>
        <WeatherIcon iconType={condition} />

        <span className='font-heading font-bold text-foreground text-[11px]'>
          {weather.tempMax}°<span className='font-normal text-muted-foreground ml-0.5'>/ {weather.tempMin}°</span>
        </span>

        {/* <span className='text-[10px] text-muted-foreground hidden sm:inline'>· {label}</span> */}
      </div>

      {/* Viento y dirección */}
      <div className='flex flex-1 items-center justify-center gap-1 text-foreground/90 font-mono'>
        <WindIcon className={duration > 0 ? 'animate-spin' : ''} style={{ animationDuration: `${duration}s` }} />

        <span className='font-heading font-bold text-foreground text-[11px]'>
          {weather.windSpeed}
          <span className='text-[10px] font-semibold pl-1'>km/h</span>
        </span>

        {/* Flecha de brújula */}
        <span
          className='inline-flex items-center transition-transform duration-300 ml-0.5'
          style={{
            transform: `rotate(${weather.windDirectionDeg}deg)`,
          }}
          title={`Viento desde el ${weather.windDirectionCardinal} (${weather.windDirectionDeg}°)`}
        >
          <ArrowCircleDownIcon size={14} />
        </span>

        <span className='text-[11px] font-bold text-muted-foreground'>{weather.windDirectionCardinal}</span>
      </div>

      {/* Ráfagas */}
      <div className='flex flex-1 items-center justify-center gap-1 text-foreground/90 font-mono'>
        <GustIcon />

        <span className='font-heading font-bold text-foreground text-[11px]'>
          {weather.windGusts}
          <span className='text-[10px] font-semibold pl-1'>km/h</span>
        </span>
      </div>

      {/* Nieve / precipitación */}
      {isSnowCondition ? (
        <div className='flex flex-1 items-center justify-center gap-1 text-cyan-500 font-mono'>
          <IconBrandSnowflake size={14} />

          <span className='font-heading font-semibold text-[11px]'>
            {weather.snowfallSum > 0 ? `${weather.snowfallSum} cm` : `${weather.precipitationProb}%`}
          </span>
        </div>
      ) : (
        weather.precipitationProb > 10 && (
          <div className='flex flex-1 items-center justify-center gap-1 text-blue-500 font-mono'>
            <DropIcon size={14} />

            <span className='font-heading font-semibold text-[11px]'>{weather.precipitationProb}%</span>
          </div>
        )
      )}
    </CustomCardInside>
  )
}
