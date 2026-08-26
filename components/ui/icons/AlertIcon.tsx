import {
  WarningIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
  CheckCircleIcon,
  type IconProps,
} from '@phosphor-icons/react'

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red'

interface AlertIconProps extends IconProps {
  level: AlertLevel
}

export function AlertIcon({ level, size = 24, weight = 'regular', ...props }: AlertIconProps) {
  const icons = {
    green: CheckCircleIcon,
    yellow: WarningIcon,
    orange: WarningCircleIcon,
    red: WarningOctagonIcon,
  }

  const Icon = icons[level]

  return <Icon size={size} weight={weight} {...props} />
}
