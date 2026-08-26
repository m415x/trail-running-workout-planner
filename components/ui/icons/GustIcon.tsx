import { IconWindsock, type IconProps } from '@tabler/icons-react'

interface GustIconProps extends IconProps {
  size?: number
}

export function GustIcon({ size = 14, ...props }: GustIconProps) {
  return <IconWindsock size={size} className='text-orange-400' {...props} />
}
