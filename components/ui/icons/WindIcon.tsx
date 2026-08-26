import { WindIcon as Wind, type IconProps } from '@phosphor-icons/react'

interface WindIconProps extends IconProps {
  size?: number
}

export function WindIcon({ size = 12, weight = 'regular', ...props }: WindIconProps) {
  return <Wind size={size} weight={weight} className='text-muted-foreground' {...props} />
}
