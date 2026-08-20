export interface MetricBoxProps {
  label: string
  value: string | number
}

export function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className='p-2.5 rounded-xl bg-secondary/30 border border-border/40'>
      <span className='text-[10px] text-muted-foreground block font-sans uppercase font-medium'>{label}</span>
      <span className='text-xs font-heading font-semibold text-foreground mt-0.5 block'>{value}</span>
    </div>
  )
}
