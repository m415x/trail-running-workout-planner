import { CardHeaderProps } from '@/utils/interfaces'

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  iconColorClass = 'text-orange-500',
  children,
}: CardHeaderProps) {
  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-col items-start'>
        <div className='flex items-center gap-2'>
          {Icon && <Icon size={16} className={iconColorClass} />}
          <h3 className='font-heading font-bold text-[17px] text-foreground'>{title}</h3>
        </div>
        {subtitle && <p className='text-muted-foreground text-[11px]'>{subtitle}</p>}
      </div>
      {children && <>{children}</>}
    </div>
  )
}
