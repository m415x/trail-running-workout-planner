import { IconWindmill, type IconProps } from '@tabler/icons-react'

interface WindIconProps extends IconProps {
  size?: number
}

export function WindIcon({ size = 12, ...props }: WindIconProps) {
  return <IconWindmill size={size} className='text-muted-foreground' {...props} />
}
