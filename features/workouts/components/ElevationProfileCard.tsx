'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Mountain } from 'lucide-react'
import { ElevTooltipProps, ElevationChartProps } from '@/features/workouts/types/workout.types'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { formatNumber } from '@/utils/formatters'

function ElevTooltip({ active, payload, label }: ElevTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className='rounded-xl border border-border/50 bg-popover/90 px-3 py-2 text-xs shadow-md backdrop-blur-md'>
      <p className='text-muted-foreground'>km {label}</p>
      <p className='font-semibold text-primary'>{payload[0].value} m</p>
    </div>
  )
}

export function ElevationProfileCard({ workout, elevData, elevMin, elevMax, yDomain }: ElevationChartProps) {
  const primaryColor = 'var(--primary)'

  return (
    <CustomCard>
      {/* Header row */}
      <CardHeader title='Perfil de Elevación' icon={Mountain}>
        <div className='flex justify-center gap-3 text-[11px]'>
          <span className='text-muted-foreground'>
            Máx <span className='text-foreground font-semibold'>{formatNumber(elevMax)} m</span>
          </span>
          <span className='text-muted-foreground'>
            Mín <span className='text-foreground font-semibold'>{formatNumber(elevMin)} m</span>
          </span>
        </div>
      </CardHeader>

      <div className='w-full h-40 min-w-0 relative my-2 select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 **:outline-none **:focus:outline-none'>
        <ResponsiveContainer width='100%' height='100%' minWidth={0} minHeight={0}>
          <AreaChart data={elevData} className='mt-2 mr-1 mb-0' margin={{ left: -30 }}>
            <defs>
              <linearGradient id='elevGrad' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor={primaryColor} stopOpacity={0.45} />
                <stop offset='100%' stopColor={primaryColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            {/* <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' strokeOpacity={1} vertical={true} /> */}
            <XAxis
              dataKey='km'
              tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              type='number'
              domain={['dataMin', 'dataMax']}
              tickCount={10}
              // tickFormatter={(value) => `${value} km`}
              stroke='#888888'
              fontSize={10}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ElevTooltip />} />
            <Area
              type='monotone'
              dataKey='elev'
              stroke={primaryColor}
              strokeWidth={2}
              fill='url(#elevGrad)'
              dot={false}
              activeDot={{ r: 4, fill: primaryColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gain / km density bar */}
      <div className='flex items-center gap-2'>
        <span className='text-muted-foreground text-[10px]'>0 km</span>
        <div className='flex-1 h-px rounded-full bg-linear-to-r from-green-500/50 via-yellow-500/50 to-red-500/50' />
        <span className='text-muted-foreground text-[10px]'>{workout.km} km</span>
      </div>
    </CustomCard>
  )
}
