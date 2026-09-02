'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { createGroup, updateGroup, type GroupFormState } from '@/app/actions/group-actions'
import type { AthleteCategoryCode, AthleteLevelCode } from '@/types/athlete/group.types'
import { Button, buttonVariants } from '@ui/button'
import { Input } from '@ui/input'

interface GroupFormValues {
  id?: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
  description?: string | null
  isActive?: boolean
}

interface GroupFormProps {
  locale: string
  group?: GroupFormValues
}

const categories: Array<{ code: AthleteCategoryCode; label: string }> = [
  { code: 'E', label: 'E' },
  { code: 'U', label: 'U' },
  { code: 'M', label: 'M' },
  { code: 'H', label: 'H' },
  { code: 'S', label: 'S' },
  { code: 'B', label: 'B' },
]

const levels: AthleteLevelCode[] = ['1', '2', '3']
const initialState: GroupFormState = {}

export function GroupForm({ locale, group }: GroupFormProps) {
  const isEditing = Boolean(group?.id)
  const action = isEditing ? updateGroup : createGroup
  const [state, formAction, pending] = useActionState(action, initialState)
  const groupsPath = locale === 'es' ? '/dashboard/groups' : `/${locale}/dashboard/groups`

  return (
    <form action={formAction} className='space-y-6'>
      <input type='hidden' name='locale' value={locale} />
      {group?.id && <input type='hidden' name='groupId' value={group.id} />}

      {state.error && (
        <div role='alert' className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      {isEditing ? (
        <div className='rounded-xl border p-4'>
          <p className='text-sm text-muted-foreground'>Grupo</p>
          <p className='text-2xl font-semibold'>{group?.categoryCode}{group?.levelCode}</p>
          <p className='mt-1 text-sm text-muted-foreground'>La categoría y el nivel definen la identidad histórica del grupo y no se modifican.</p>
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2'>
          <SelectField label='Categoría' name='categoryCode' required>
            <option value=''>Seleccionar categoría</option>
            {categories.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
          </SelectField>
          <SelectField label='Nivel' name='levelCode' required>
            <option value=''>Seleccionar nivel</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </SelectField>
        </div>
      )}

      <div className='space-y-1.5'>
        <label htmlFor='description' className='text-sm font-medium'>Descripción</label>
        <Input id='description' name='description' defaultValue={group?.description ?? ''} placeholder='Ej.: Montaña intermedio' />
      </div>

      {isEditing && (
        <div className='space-y-1.5'>
          <label htmlFor='isActive' className='text-sm font-medium'>Estado</label>
          <select
            id='isActive'
            name='isActive'
            defaultValue={group?.isActive === false ? 'false' : 'true'}
            className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
          >
            <option value='true'>Activo</option>
            <option value='false'>Inactivo</option>
          </select>
        </div>
      )}

      <div className='flex justify-end gap-2'>
        <Link href={groupsPath} className={buttonVariants({ variant: 'outline' })}>Cancelar</Link>
        <Button type='submit' disabled={pending}>
          {pending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear grupo'}
        </Button>
      </div>
    </form>
  )
}

function SelectField({ label, name, required, children }: { label: string; name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <label htmlFor={name} className='text-sm font-medium'>{label}{required && <span className='text-destructive'> *</span>}</label>
      <select
        id={name}
        name={name}
        required={required}
        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
      >
        {children}
      </select>
    </div>
  )
}
