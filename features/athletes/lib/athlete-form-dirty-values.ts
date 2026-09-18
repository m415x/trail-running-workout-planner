export interface AthleteFormDirtySource {
  id?: string
  firstName: string
  lastName: string
  email: string
  dni: string
  nickName?: string | null
  birthday?: string | null
  phone?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
}

export interface AthleteFormDirtyValues {
  [key: string]: string
  firstName: string
  lastName: string
  email: string
  dni: string
  nickName: string
  birthday: string
  phone: string
  emergencyContact: string
  emergencyPhone: string
}

export function athleteFormDirtyValues(
  source: AthleteFormDirtySource,
): AthleteFormDirtyValues {
  return {
    firstName: source.firstName,
    lastName: source.lastName,
    email: source.email,
    dni: source.dni,
    nickName: source.nickName ?? '',
    birthday: source.birthday ?? '',
    phone: source.phone ?? '',
    emergencyContact: source.emergencyContact ?? '',
    emergencyPhone: source.emergencyPhone ?? '',
  }
}


function formDataString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export function athleteFormDirtyValuesFromFormData(
  formData: FormData,
): AthleteFormDirtyValues {
  return athleteFormDirtyValues({
    firstName: formDataString(formData, 'firstName'),
    lastName: formDataString(formData, 'lastName'),
    email: formDataString(formData, 'email'),
    dni: formDataString(formData, 'dni'),
    nickName: formDataString(formData, 'nickName'),
    birthday: formDataString(formData, 'birthday'),
    phone: formDataString(formData, 'phone'),
    emergencyContact: formDataString(formData, 'emergencyContact'),
    emergencyPhone: formDataString(formData, 'emergencyPhone'),
  })
}
