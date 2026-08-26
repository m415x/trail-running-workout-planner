import { HurricaneIcon, type IconProps } from '@phosphor-icons/react'

interface GustIconProps extends IconProps {
  size?: number
}

export function GustIcon({ size = 12, weight = 'regular', ...props }: GustIconProps) {
  return <HurricaneIcon size={size} weight={weight} className='text-orange-400' {...props} />
}
