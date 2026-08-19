import { ZoneRowProps } from '@/types'

export function ZoneRow({ zone, name, range, color }: ZoneRowProps) {
  return (
    <div className='flex items-center justify-between p-2 rounded-xl bg-secondary/30 border border-border/30'>
      <div className='flex items-center gap-2'>
        <span className={`text-[10px] font-heading font-bold px-1.5 py-0.5 rounded text-white ${color}`}>{zone}</span>
        <span className='text-xs font-medium text-foreground'>{name}</span>
      </div>
      <span className='font-mono text-xs text-muted-foreground'>{range}</span>
    </div>
  )
}
