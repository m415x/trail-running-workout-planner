import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Users, TrendingUp, CalendarDays, DollarSign } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-3xl font-bold tracking-tight'>Resumen General</h2>
        <p className='text-muted-foreground'>Vista general del equipo y las planificaciones activas.</p>
      </div>

      {/* KPIs */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Atletas Activos</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>24</div>
            <p className='text-xs text-muted-foreground'>+2 desde el mes pasado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Planificaciones Activas</CardTitle>
            <CalendarDays className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>8</div>
            <p className='text-xs text-muted-foreground'>Macrociclos en curso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Ingresos del Mes</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>$1,250</div>
            <p className='text-xs text-muted-foreground'>85% de membresías al día</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Alertas Fisiológicas</CardTitle>
            <TrendingUp className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-500'>3</div>
            <p className='text-xs text-muted-foreground'>Atletas con sobrecarga reportada</p>
          </CardContent>
        </Card>
      </div>

      {/* Aquí puedes añadir tablas recientes o gráficos */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-7'>
        <Card className='col-span-4'>
          <CardHeader>
            <CardTitle>Próximas Competencias del Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>Tabla de carreras asignadas (pendiente de implementar)</p>
          </CardContent>
        </Card>
        <Card className='col-span-3'>
          <CardHeader>
            <CardTitle>Pagos Pendientes</CardTitle>
            <CardDescription>3 atletas requieren seguimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>Lista resumida de morosos (pendiente de implementar)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
