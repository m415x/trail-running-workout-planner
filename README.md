# trail-running-workout-planner

Full-stack web application for trail running group management, workout planning, and runner metrics. Built with Next.js, React, Tailwind CSS, and Supabase.

## Project structure

```textplain
.
├── app/
│   ├── (mobile)/                           # Route Group para la experiencia PWA / Phone Shell
│   │   ├── layout.tsx                      # Shell contenedor fijo (max-w-97.5), ScrollArea y BottomNav
│   │   ├── page.tsx                        # Ruta "/" -> Pestaña Inicio (Dashboard)
│   │   ├── plan/
│   │   │   └── page.tsx                    # Ruta "/plan" -> Pestaña Calendario / Microciclos
│   │   ├── stats/
│   │   │   └── page.tsx                    # Ruta "/stats" -> Pestaña Estadísticas / Gráficos
│   │   └── profile/
│   │       └── page.tsx                    # Ruta "/profile" -> Pestaña Perfil del Atleta
│   ├── globals.css
│   ├── layout.tsx                          # Root layout (HTML, Body, ThemeProvider, Fuentes)
│   └── favicon.ico
│
├── components/
│   ├── layout/                             # Componentes de estructura global
│   │   └── BottomNavigationBar.tsx         # Barra inferior con <Link> de Next.js
│   ├── ui/                                 # UI primitives de Shadcn (botones, avatar, dialog, etc.)
│   │   ├── custom/                         # Tus contenedores y píldoras personalizadas
│   │   │   ├── buttons.tsx
│   │   │   ├── card-containers.tsx
│   │   │   ├── pills.tsx
│   │   │   ├── progress-gradient.tsx
│   │   │   └── section-header.tsx
│   │   └── ... (avatar, tabs, card, etc.)
│   └── maps/                               # Módulos pesados o con SSR dinámico
│       └── MapInner.tsx
│
├── features/
│   ├── workouts/                           # Todo lo relativo a rutinas y calendario semanal
│   │   ├── components/
│   │   │   ├── HomeHeader.tsx           # Header superior del atleta
│   │   │   ├── WeeklyCalendarCard.tsx
│   │   │   ├── WorkoutCard.tsx             # (TodayWorkoutCard, RaceCard)
│   │   │   ├── ElevationProfileCard.tsx
│   │   │   ├── RouteMapCard.tsx
│   │   │   ├── DaySelectorButton.tsx
│   │   │   └── DayStatusIndicator.tsx
│   │   └── hooks/
│   │       └── useHomeTab.ts
│   ├── profile/                            # Todo lo relativo al perfil y fisiología
│   │   └── components/
│   │       └── ProfileView.tsx
│   ├── plan/                               # Futuro módulo de planificación anual
│   └── stats/                              # Futuro módulo de estadísticas
│
├── data/                                   # Mocks y seeds de datos
│   └── data.ts
│
├── lib/
│   ├── utils.ts                            # cn() y helpers de Tailwind
│   └── gpx/                                # Parsers y cálculos geográficos
│       ├── gpx-parser.ts
│       └── calculators.ts
│
├── types/                                  # En lugar de interfaces.ts suelto
│   ├── workout.types.ts
│   ├── user.types.ts
│   └── gpx.types.ts
│
└── utils/                                  # Helpers de formato puro
    ├── constants.ts
    ├── date-helpers.ts
    ├── formatters.ts
    └── workout-helpers.ts
```
