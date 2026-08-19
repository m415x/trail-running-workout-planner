'use client'

import { CheckCircle2, Flame, MapPin, Timer, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PrimaryInput } from '@/components/ui/custom/inputs'
import { PrimaryFilledButton, GlassOutlineButton } from '@/components/ui/custom/buttons'
import { LogWorkoutDialogProps } from '@/types'
import { RpeSelector } from '@/features/workouts/components/RpeSelector'
import { useLogWorkoutDialog } from '@/features/workouts/hooks/useLogWorkoutDialog'

export function LogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  const {
    distance,
    timeMin,
    timeSec,
    rpe,
    athleteNotes,
    setDistance,
    setTimeMin,
    setTimeSec,
    setRpe,
    setAthleteNotes,
    handleSave,
  } = useLogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md w-[92vw] sm:w-full rounded-3xl p-5 bg-card border-border/80 max-h-[90dvh] overflow-y-auto'>
        {/* Elemento oculto que captura el foco inicial de Base UI para que no salte al input */}
        <span tabIndex={0} aria-hidden='true' className='sr-only focus:outline-none' />

        <DialogHeader className='text-left'>
          <DialogTitle className='font-heading font-bold text-lg text-foreground flex items-center gap-2'>
            <CheckCircle2 size={20} className='text-primary' />
            Registrar Entrenamiento
          </DialogTitle>
          <p className='text-xs text-muted-foreground p-0'>
            {workout?.title ?? 'Sesión completada'} <br /> {dateStr ?? 'Hoy'}
          </p>
        </DialogHeader>

        <div className='space-y-4 my-1'>
          {/* Métricas Numéricas Principales */}
          <div className='grid grid-cols-2 gap-2.5'>
            {/* ── Columna 1: Distancia ── */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <MapPin size={11} /> Distancia (km)
              </label>
              <PrimaryInput
                type='number'
                step='0.01'
                min='0'
                placeholder='0.00'
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>

            {/* ── Columna 2: Tiempo (Minutos + Segundos) ── */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <Timer size={11} /> Tiempo (min : seg)
              </label>

              <div className='grid grid-cols-2 gap-1.5'>
                <PrimaryInput
                  type='number'
                  min='0'
                  placeholder='Min'
                  value={timeMin}
                  onChange={(e) => setTimeMin(e.target.value)}
                />

                <PrimaryInput
                  type='number'
                  min='0'
                  max='59'
                  placeholder='0'
                  value={timeSec}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (isNaN(val)) setTimeSec('')
                    else if (val >= 0 && val <= 59) setTimeSec(e.target.value)
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Selector de Esfuerzo Percibido (RPE) ── */}
          <div className='space-y-1.5'>
            <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
              <Flame size={12} /> Esfuerzo Percibido (RPE 1-10)
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

        <DialogFooter className='flex flex-row gap-2 mt-2 bg-card'>
          <GlassOutlineButton onClick={onClose} className='flex-1'>
            Cancelar
          </GlassOutlineButton>
          <PrimaryFilledButton onClick={handleSave} className='flex-1'>
            Guardar Sesión
          </PrimaryFilledButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
