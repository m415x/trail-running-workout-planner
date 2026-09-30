# UI Design System foundations

Status: KAN-507 T1 baseline. This document defines the current authority and boundaries that later KAN-507 tasks may evolve. It is not a cross-application redesign checklist.

## Authority

The executable/versioned Design System authority is Git:

```text
app/globals.css semantic variables + Tailwind theme mapping
        ↓
components/ui shadcn/Base UI primitives
        ↓
EPT semantic primitives / shared product patterns
        ↓
feature compositions
```

Figma may support exploration and visual specification but does not override repository behavior. Storybook is optional tooling and is introduced only if real shared components demonstrate a material need for an executable isolated catalog. The application remains final integration evidence.

KAN-507 defines and implements foundations and reusable contracts. KAN-508 applies and normalizes those contracts across the MVP. Do not turn KAN-507 into a page-by-page redesign.

## Current foundations inventory

### Typography

The localized root layout loads:

- Geist Sans;
- Geist Mono;
- Barlow Condensed;
- DM Sans;
- Outfit.

`app/globals.css` currently exposes:

- `--font-heading` → Outfit;
- `--font-body` → DM Sans;
- `--font-mono` → Geist Mono.

The application body consumes `font-body`. Existing surfaces also use `font-heading` and monospace utility classes directly.

The current global root scale remains an explicit legacy accessibility constraint:

- mobile root font size: 120%;
- from 640px: 100%.

KAN-507 must preserve the rule `semantic typography != responsive composition != accessibility scaling`. T2/T4 may define explicit typography and responsive contracts, but the 120% mobile scale must not be removed without evidence of equivalent or better real-device legibility.

### Color and semantic state

`app/globals.css` already maps Tailwind-facing semantic colors onto CSS variables for:

- background / foreground;
- card / popover;
- primary / secondary / accent;
- muted;
- destructive;
- border / input / ring;
- sidebar;
- chart 1–5;
- heart-rate zone 1–5;
- glass / overlay surfaces.

Light and dark values already exist. These variables are the starting implementation evidence, not automatically the final KAN-507 contract.

Current comments associate the existing palette with the El Parque Team visual identity: orange, dark violet and lilac/pink accents. T2 must validate and normalize semantic purpose before treating those comments or literal values as durable Brand authority.

### Radius and surface shape

The Tailwind theme currently derives `sm` through `4xl` radii from one `--radius` root. Shared wrappers frequently use larger explicit radius utilities such as `rounded-xl`, `rounded-2xl` and `rounded-3xl`.

T2/T3 must distinguish semantic shape decisions from feature-local styling instead of creating additional parallel scales.

### Light/dark

`ThemeProvider` uses class-based theming with system default support. Both light and dark semantic variables already exist. KAN-507 should evolve these same semantic authorities rather than introduce a second theme source.

## Primitive inventory and ownership

### Base primitives

`components/ui/*` contains the shadcn/Base UI layer. Existing primitives include buttons, inputs, selects, checkboxes, dialogs, alert dialogs, sheets, tabs, accordions, sliders, badges, toggles, scroll areas, calendars, carousels and related controls.

This layer supplies low-level behavior and already contains useful accessibility behavior such as keyboard semantics and `focus-visible` treatment. KAN-507 must preserve that behavior when introducing EPT semantics.

### Existing EPT wrappers

`components/ui/custom/*` is currently a mixed layer rather than a fully-defined Design System boundary.

Observed reusable wrappers include:

- `CustomButton` and primary/secondary/glass button variants;
- `PillButton`;
- `ThemeToggleButton`;
- `CustomCard`, `CustomCardInside`, `StatCard`;
- `PrimaryInput`;
- `StatPill`, `ZonePill`;
- `CardHeader`;
- `ConfirmActionDialog`;
- `ProgressGradient`.

These are candidates for T3 reconciliation, not automatically official product patterns.

## Current debt classification

T1 records debt so later work can place it in the correct boundary; it does not silently fix all of it.

### KAN-507 foundation / primitive debt

Examples that belong to later KAN-507 slices when the shared contract is touched:

- direct presentation literals such as `text-white` and `text-orange-500` inside shared wrappers instead of semantic tokens;
- shared wrappers that combine behavior, product semantics and styling without a documented ownership boundary;
- shared defaults that expose Spanish presentation text from a reusable component;
- inconsistent explicit text sizes that precede a semantic typography hierarchy;
- shared touch targets whose dimensions must be reconciled against the approved Athlete mobile/outdoor accessibility baseline.

### KAN-508 application debt

Feature-level pages may use inconsistent hierarchy, density, cards, forms, loading/empty/error presentation or responsive composition. Those surfaces should consume the contracts established here rather than be comprehensively normalized inside KAN-507.

A KAN-507 task may touch a representative consumer when required to prove a shared contract, but that does not authorize broad migration.

## Approved composition boundary

Use this conceptual layering when deciding where code belongs:

```text
shadcn/Base UI primitive
        ↓
EPT semantic primitive
        ↓
EPT product pattern
        ↓
feature composition
```

Definitions:

- **Primitive** — low-level accessible interaction/control with minimal product meaning.
- **EPT semantic primitive** — stable EPT visual/interaction semantics built on a primitive, such as an approved action or surface treatment.
- **Product pattern** — reusable composition with product-level purpose and interaction rules, such as a standard section header or status presentation.
- **Feature composition** — domain-specific arrangement owned by one workflow/surface.

Do not promote a one-off feature composition into the shared layer solely to reduce file duplication.

## Responsive and accessibility boundaries

KAN-507 will define:

- Coach desktop-first composition with deliberate compression;
- Athlete mobile-first composition with deliberate expansion;
- one Athlete four-destination IA;
- WCAG 2.2 AA as the technical baseline for tokens/primitives/patterns KAN-507 defines or officializes;
- mobile/outdoor-appropriate Athlete touch targets.

KAN-507 is not a complete WCAG audit of every existing page. KAN-508 applies and verifies the shared contracts transversally.

## PWA and maps

PWA presentation must consume Brand foundations rather than define an independent palette.

The cartographic decision is separate from the Design System authority. KAN-507 keeps the approved MapLibre-first monocolor benchmark and may compare historical Leaflet only after reasonable integration defects have been isolated and corrected.

## External tooling

Experimental external tooling is outside the KAN-507 Definition of Done.

The approved Archify pilot is temporary, unversioned, outside T1–T8 and cannot become an architectural authority or block story closure.
