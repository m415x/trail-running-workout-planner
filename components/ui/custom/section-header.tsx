import { SectionHeaderProps } from '@/utils/interfaces'

export function CardHeader({ title, icon: Icon, iconColorClass = 'text-orange-500', action }: SectionHeaderProps) {
  return (
    <div className='flex items-center justify-between mb-3'>
      <div className='flex items-center gap-2'>
        {Icon && <Icon size={16} className={iconColorClass} />}
        <h3 className='font-barlow font-bold text-[17px] text-foreground'>{title}</h3>
      </div>
      {action && <>{action}</>}
    </div>
  )
}
