export type IntensityZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export type IntensityMethod = 'hr_zone' | 'pam_percentage'

export type TrainingIntensity =
  | {
      method: 'hr_zone'
      zone: IntensityZone
    }
  | {
      method: 'pam_percentage'
      percentage: number
    }
