'use client'

import { CheckCircle2, HeartPulse, MapPin, Mountain, Timer, MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ScrollArea } from '@ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ui/dialog'
import { PrimaryInput } from '@ui/custom/inputs'
import type { ManualRealizedTrainingClientInput, WorkoutProps } from '@/types'
import { PrimaryFilledButton, GlassOutlineButton } from '@ui/custom/buttons'
import { SelfAssessment } from '@workouts/components/SelfAssessment'
import { useLogWorkoutDialog } from '@workouts/hooks/useLogWorkoutDialog'

export interface LogWorkoutDialogProps {
  isOpen?: boolean
  onClose: () => void
  workout?: WorkoutProps | null
  dateStr?: string
  initialInput?: ManualRealizedTrainingClientInput | null
  onSave?: (loggedData: ManualRealizedTrainingClientInput) => Promise<boolean>
}

export function LogWorkoutDialog({
  isOpen,
  onClose,
  workout,
  dateStr,
  initialInput,
  onSave,
}: LogWorkoutDialogProps) {
  const t = useTranslations('Workouts')
  const {
    distance,
    timeMin,
    timeHr,
    timeSec,
    gain,
    avgHr,
    assessment,
    athleteNotes,
    isSaving,
    setDistance,
    setTimeHr,
    handleMinutesChange,
    setTimeSec,
    setGain,
    setAvgHr,
    setAssessment,
    setAthleteNotes,
    handleSave,
    performedLocal,
    setPerformedLocal,
    saveError,
    resetForm,
  } = useLogWorkoutDialog({ isOpen, onClose, workout, dateStr, initialInput, onSave })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose() }}>
      <DialogContent className='max-w-md w-[92vw] sm:w-full rounded-3xl p-4 bg-card border-border/80 h-[75dvh] max-h-160 flex flex-col overflow-hidden gap-0'>
        <span tabIndex={0} aria-hidden='true' className='sr-only focus:outline-none' />

        <DialogHeader className='text-left pb-3 border-b border-border/40 shrink-0'>
          <DialogTitle className='font-heading font-bold text-lg text-foreground flex items-center gap-2'>
            <CheckCircle2 size={20} className='text-primary' />
            {t('dialog.title')}
          </DialogTitle>
          <p className='text-xs text-muted-foreground p-0'>
            {dateStr ?? '—'}{workout?.title ? <> &bull; {workout.title}</> : null}
          </p>
        </DialogHeader>

        <ScrollArea className='flex-1 min-h-0 w-full'>
          <div className='space-y-4 pt-4 pb-1 px-0.5'>
            <label className='block space-y-1 text-xs'>
              <span>{t('dialog.performedAt')}</span>
              <PrimaryInput type='datetime-local' step='1' required value={performedLocal}
                disabled={isSaving} onChange={(event) => setPerformedLocal(event.target.value)} />
              <span className='text-muted-foreground'>{t('dialog.localTimeHint')}</span>
            </label>
            {saveError && <p role='alert' className='text-sm text-destructive'>{t(`dialog.${saveError}`)}</p>}
            <div className='grid grid-cols-2 gap-2.5'>
              <div className='space-y-1'>
                <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                  <MapPin size={11} /> {t('dialog.distance')}
                </label>
                <PrimaryInput
                  type='number'
                  step='0.01'
                  min='0'
                  placeholder={workout?.distance != null ? String(workout.distance) : '0.00'}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1 pl-1'>
                  <Timer size={11} /> {t('dialog.time')}
                </label>

                <div className='grid grid-cols-3 gap-1.5'>
                  <PrimaryInput type='number' min='0' placeholder='0' value={timeHr} onChange={(e) => setTimeHr(e.target.value)} />
                  <PrimaryInput type='number' min='0' placeholder='0' value={timeMin} onChange={(e) => handleMinutesChange(e.target.value)} />
                  <PrimaryInput
                    type='number'
                    min='0'
                    max='59'
                    placeholder='0'
                    value={timeSec}
                    onChange={(e) => setTimeSec(e.target.value)}
                  />
                </div>
              </div>

              <div className='space-y-1'>
                <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                  <Mountain size={11} /> {t('dialog.elevation')}
                </label>
                <PrimaryInput
                  type='number'
                  min='0'
                  step='1'
                  placeholder={workout?.gain != null ? String(workout.gain) : '0'}
                  value={gain}
                  onChange={(e) => setGain(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                  <HeartPulse size={11} /> {t('dialog.heartRate')}
                </label>
                <PrimaryInput
                  type='number'
                  min='0'
                  step='1'
                  placeholder='—'
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                />
              </div>
            </div>

            <SelfAssessment value={assessment} onChange={setAssessment} />

            <div className='space-y-1'>
              <label className='text-[10px] font-sans font-semibold text-muted-foreground uppercase flex items-center gap-1'>
                <MessageSquare size={11} /> {t('dialog.notes')}
              </label>
              <textarea
                rows={3}
                placeholder={t('dialog.notesPlaceholder')}
                value={athleteNotes}
                onChange={(e) => setAthleteNotes(e.target.value)}
                className='bg-background rounded-xl p-3 border border-border w-full text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none'
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className='flex flex-row gap-2 py-3.5 border-t border-border/40 bg-card shrink-0 mt-0'>
          <GlassOutlineButton onClick={resetForm} disabled={isSaving}>{t('dialog.clear')}</GlassOutlineButton>
          <GlassOutlineButton onClick={onClose} className='flex-4' disabled={isSaving}>
            {t('dialog.cancel')}
          </GlassOutlineButton>
          <PrimaryFilledButton onClick={() => void handleSave()} className='flex-6' disabled={isSaving}>
            {t('dialog.save')}
          </PrimaryFilledButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
