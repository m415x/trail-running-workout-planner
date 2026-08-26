import { WeatherCondition } from '@/types'
import {
  SunIcon,
  CloudSunIcon,
  CloudIcon,
  CloudRainIcon,
  CloudLightningIcon,
  SnowflakeIcon,
  CloudFogIcon,
  CloudSnowIcon,
  WindIcon,
  type IconProps,
} from '@phosphor-icons/react'

interface WeatherIconProps extends IconProps {
  iconType: WeatherCondition
}

export function WeatherIcon({ iconType, size = 16, weight = 'regular', ...props }: WeatherIconProps) {
  const commonProps = {
    size,
    weight,
    className: 'shrink-0',
    ...props,
  }

  switch (iconType) {
    case 'clear':
      return <SunIcon {...commonProps} className='text-amber-500 animate-spin-slow' {...props} />

    case 'partly-cloudy':
      return <CloudSunIcon {...commonProps} className='text-amber-400' {...props} />

    case 'cloudy':
      return <CloudIcon {...commonProps} className='text-sky-400' {...props} />

    case 'fog':
      return <CloudFogIcon {...commonProps} className='text-slate-400' {...props} />

    case 'rain':
      return <CloudRainIcon {...commonProps} className='text-blue-400' {...props} />

    case 'heavy-rain':
      return <CloudRainIcon {...commonProps} weight={'fill'} className='text-blue-400' {...props} />

    case 'snow':
      return <SnowflakeIcon {...commonProps} className='text-cyan-300' {...props} />

    case 'sleet':
      return <CloudSnowIcon {...commonProps} className='text-cyan-300' {...props} />

    case 'thunderstorm':
      return <CloudLightningIcon {...commonProps} className='text-purple-400' {...props} />

    case 'windy':
      return <WindIcon {...commonProps} className='text-slate-400' {...props} />

    default:
      return null
  }
}
