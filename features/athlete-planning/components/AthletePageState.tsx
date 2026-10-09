import { CustomCard } from '@/components/ui/custom/card-containers'

/**
 * Shared athlete page feedback. Authorization is decided server-side;
 * this component only presents the already classified state.
 */
export function AthletePageState({ message }: { message: string }) {
  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6'>
      <CustomCard role='alert' className='items-center py-8 text-center text-sm text-destructive'>
        <p>{message}</p>
      </CustomCard>
    </div>
  )
}
