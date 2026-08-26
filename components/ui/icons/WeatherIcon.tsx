import {
  SunIcon,
  CloudSunIcon,
  CloudIcon,
  CloudRainIcon,
  CloudLightningIcon,
  SnowflakeIcon,
  CloudFogIcon,
  type IconProps,
} from '@phosphor-icons/react'

export type WeatherIconType = 'sun' | 'cloud-sun' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow'

interface WeatherIconProps extends IconProps {
  iconType: WeatherIconType
}

export function WeatherIcon({ iconType, size = 15, weight = 'regular', ...props }: WeatherIconProps) {
  switch (iconType) {
    case 'sun':
      return <SunIcon size={size} weight={weight} className='text-amber-500 shrink-0 animate-spin-slow' {...props} />

    case 'cloud-sun':
      return <CloudSunIcon size={size} weight={weight} className='text-amber-400 shrink-0' {...props} />

    case 'cloud':
      return <CloudIcon size={size} weight={weight} className='text-sky-400 shrink-0' {...props} />

    case 'fog':
      return <CloudFogIcon size={size} weight={weight} className='text-slate-400 shrink-0' {...props} />

    case 'rain':
      return <CloudRainIcon size={size} weight={weight} className='text-blue-400 shrink-0' {...props} />

    case 'storm':
      return <CloudLightningIcon size={size} weight={weight} className='text-purple-400 shrink-0' {...props} />

    case 'snow':
      return <SnowflakeIcon size={size} weight={weight} className='text-cyan-300 shrink-0' {...props} />

    default:
      return null
  }
}
