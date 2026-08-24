'use client'

import { CheckCircle2, MapPin, Timer, MessageSquare, RotateCcw } from 'lucide-react'
import { ScrollArea } from '@ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ui/dialog'
import { PrimaryInput } from '@ui/custom/inputs'
import { LogWorkoutDialogProps } from '@/types'
import { PrimaryFilledButton, GlassOutlineButton } from '@ui/custom/buttons'
import { ConfirmActionDialog } from '@ui/custom/confirm-dialog'
import { SelfAssessment } from '@workouts/components/SelfAssessment'
import { useLogWorkoutDialog } from '@workouts/hooks/useLogWorkoutDialog'

export function LogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave, onDelete }: LogWorkoutDialogProps) {
  const {
    distance,
    timeMin,
    timeHr,
    timeSec,
    assessment,
    athleteNotes,
    setDistance,
    setTimeHr,
    handleMinutesChange,
    setTimeSec,
    setAssessment,
    setAthleteNotes,
    handleSave,
    handleDelete,
  } = useLogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave, onDelete })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md w-[92vw] sm:w-full rounded-3xl p-4 bg-card border-border/80 h-[75dvh] max-h-160 flex flex-col overflow-hidden gap-0'>
        {/* Elemento oculto que captura el foco inicial de Base UI para que no salte al input */}
        <span tabIndex={0} aria-hidden='true' className='sr-only focus:outline-none' />

        {/* ── 1. DialogHeader Fijo ── */}
        <DialogHeader className='text-left pb-3 border-b border-border/40 shrink-0'>
          <DialogTitle className='font-heading font-bold text-lg text-foreground flex items-center gap-2'>
            <CheckCircle2 size={20} className='text-primary' />
            Registrar Entrenamiento
          </DialogTitle>
          <p className='text-xs text-muted-foreground p-0'>
            {dateStr ?? 'Hoy'} &bull; {workout?.title ?? 'Sesión completada'}
          </p>
        </DialogHeader>

        {/* ── 2. ScrollArea Central (Única área con scroll) ── */}
        <ScrollArea className='flex-1 min-h-0 w-full'>
          <div className='space-y-4 pt-4 pb-1 px-0.5'>
            {/* Métricas Numéricas Principales */}
            <div className='grid grid-cols-2 gap-2.5'>
              {/* Columna 1: Distancia */}
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

              {/* Columna 2: Tiempo */}
              <div className='space-y-1'>
                <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1 pl-1'>
                  <Timer size={11} /> Tiempo (hr : min : seg)
                </label>

                <div className='grid grid-cols-3 gap-1.5'>
                  <PrimaryInput
                    type='number'
                    min='0'
                    placeholder='0'
                    value={timeHr}
                    onChange={(e) => setTimeHr(e.target.value)}
                  />

                  <PrimaryInput
                    type='number'
                    min='0'
                    placeholder='0'
                    value={timeMin}
                    onChange={(e) => handleMinutesChange(e.target.value)}
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

            {/* Autoevaluación del esfuerzo */}
            <SelfAssessment value={assessment} onChange={setAssessment} />

            {/* Comentarios del Atleta para el Coach */}
            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <MessageSquare size={11} /> Feedback para el entrenador
              </label>
              <textarea
                rows={3}
                placeholder='¿Cómo te sentiste? ¿Molestias, clima, sensaciones en subidas?'
                value={athleteNotes}
                onChange={(e) => setAthleteNotes(e.target.value)}
                className='bg-background rounded-xl p-3 border border-border w-full text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none'
              />
            </div>
          </div>
        </ScrollArea>

        {/* ── 3. DialogFooter Fijo ── */}
        <DialogFooter className='flex flex-row gap-2 py-3.5 border-t border-border/40 bg-card shrink-0 mt-0'>
          <ConfirmActionDialog
            title='¿Restablecer registro?'
            description='Se eliminarán las métricas ingresadas para esta sesión y volverá al estado original.'
            confirmLabel='Restablecer'
            cancelLabel='Cancelar'
            variant='destructive'
            onConfirm={handleDelete}
            trigger={(open) => (
              <GlassOutlineButton variant='destructive' title='Eliminar registro' onClick={open} className='flex-1'>
                <RotateCcw className='size-4' />
              </GlassOutlineButton>
            )}
          />
          <GlassOutlineButton onClick={onClose} className='flex-4'>
            Cancelar
          </GlassOutlineButton>
          <PrimaryFilledButton onClick={handleSave} className='flex-6'>
            Guardar
          </PrimaryFilledButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
