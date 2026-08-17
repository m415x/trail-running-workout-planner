'use client'

import { CheckCircle2, Flame, MapPin, Mountain, Timer, Heart, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogWorkoutDialogProps } from '@/features/workouts/types/workout.types'
import { RpeSelector } from './RpeSelector'
import { useLogWorkoutDialog } from '@/features/workouts/hooks/useLogWorkoutDialog'

export function LogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  const {
    distance,
    timeMin,
    gain,
    avgHr,
    rpe,
    athleteNotes,
    setDistance,
    setTimeMin,
    setGain,
    setAvgHr,
    setRpe,
    setAthleteNotes,
    handleSave,
  } = useLogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md w-[92vw] sm:w-full rounded-3xl p-5 bg-card border-border/80 max-h-[90dvh] overflow-y-auto'>
        {/* Elemento oculto que captura el foco inicial de Base UI para que no salte al input */}
        <span tabIndex={0} aria-hidden='true' className='sr-only focus:outline-none' />

        <DialogHeader className='text-left space-y-1'>
          <DialogTitle className='font-heading font-bold text-lg text-foreground flex items-center gap-2'>
            <CheckCircle2 size={20} className='text-primary' />
            Registrar Entrenamiento
          </DialogTitle>
          <p className='text-xs text-muted-foreground'>
            {workout?.title ?? 'Sesión completada'} · {dateStr ?? 'Hoy'}
          </p>
        </DialogHeader>

        <div className='space-y-4 my-2'>
          {/* Métricas Numéricas Principales */}
          <div className='grid grid-cols-2 gap-2.5'>
            {/* Distancia */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <MapPin size={11} /> Distancia (km)
              </label>
              <Input
                type='number'
                step='0.1'
                placeholder='0.0'
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className='h-10 rounded-xl font-mono text-sm'
              />
            </div>

            {/* Tiempo */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <Timer size={11} /> Tiempo (min)
              </label>
              <Input
                type='number'
                placeholder='Minutos'
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
                className='h-10 rounded-xl font-mono text-sm'
              />
            </div>

            {/* Desnivel Positivo */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <Mountain size={11} /> Desnivel + (m)
              </label>
              <Input
                type='number'
                placeholder='Metros'
                value={gain}
                onChange={(e) => setGain(e.target.value)}
                className='h-10 rounded-xl font-mono text-sm'
              />
            </div>

            {/* Frecuencia Cardíaca Media */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <Heart size={11} /> FC Media (bpm)
              </label>
              <Input
                type='number'
                placeholder='155'
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                className='h-10 rounded-xl font-mono text-sm'
              />
            </div>
          </div>

          {/* ── Selector de Esfuerzo Percibido (RPE) ── */}
          <div className='space-y-1.5'>
            <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
              <Flame size={12} className='text-primary' /> Esfuerzo Percibido (RPE 1-10)
            </label>
            <RpeSelector value={rpe} onChange={setRpe} />
          </div>

          {/* Comentarios del Atleta para el Coach */}
          <div className='space-y-1'>
            <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
              <MessageSquare size={11} /> Feedback para el entrenador
            </label>
            <textarea
              rows={2}
              placeholder='¿Cómo te sentiste? ¿Molestias, clima, sensaciones en subidas?'
              value={athleteNotes}
              onChange={(e) => setAthleteNotes(e.target.value)}
              className='bg-background rounded-xl p-4 border border-border w-full text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none'
            />
          </div>
        </div>

        <DialogFooter className='flex flex-row gap-2 mt-2'>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            className='flex-1 rounded-xl h-10 text-xs font-semibold'
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            className='flex-1 rounded-xl h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-md cursor-pointer'
          >
            Guardar Sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
