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
