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

## Foundation contract

KAN-557 makes the following foundations executable and durable. Naming is semantic: feature code should consume purpose-oriented tokens rather than duplicate Brand values or invent parallel scales.

### Brand roles and usage semantics

Brand roles are the palette authority:

- `--brand-action`;
- `--brand-identity`;
- `--brand-highlight`.

Usage semantics consume those Brand roles:

- `--primary` → `--brand-action`;
- `--secondary` → `--brand-identity`;
- `--accent` → `--brand-highlight`.

Light and dark themes may assign different concrete Brand values while preserving the same semantic roles. PWA presentation must consume these same foundations instead of defining another palette.

### Semantic typography

Typography hierarchy is explicit through:

- `--text-ept-display`;
- `--text-ept-heading`;
- `--text-ept-title`;
- `--text-ept-body`;
- `--text-ept-body-compact`;
- `--text-ept-label`;
- `--text-ept-caption`;
- `--text-ept-data`.

The contract is:

`semantic typography != responsive composition != accessibility scaling`.

The existing mobile root 120% scaling therefore remains an accessibility constraint, not a substitute for hierarchy or breakpoint composition. It resets to 100% from 640px and must not be removed until Athlete real-device evidence demonstrates equivalent or better legibility.

### Semantic spacing, shape, and elevation

Spacing/density uses a small purpose-oriented scale:

- `--space-ept-tight`;
- `--space-ept-control`;
- `--space-ept-content`;
- `--space-ept-section`.

Semantic shape aliases the existing radius scale instead of creating a second geometry system:

- `--radius-ept-control` → `--radius-md`;
- `--radius-ept-surface` → `--radius-xl`;
- `--radius-ept-overlay` → `--radius-2xl`.

Semantic elevation is limited to:

- `--elevation-ept-raised`;
- `--elevation-ept-overlay`.

These foundations define shared intent. KAN-508 remains responsible for transversal feature-level normalization.

### Contrast baseline

WCAG 2.2 AA is the technical contrast baseline for semantic color pairs officialized by KAN-507. Focused regression tests verify at least 4.5:1 normal-text contrast for representative light/dark pairs including action, identity, highlight, destructive, background, and card semantics.

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

The El Parque Team palette is now expressed through the Brand role tokens above. Literal values remain implementation details of each theme rather than a second authority.

### Radius and surface shape

The Tailwind theme currently derives `sm` through `4xl` radii from one `--radius` root. Shared wrappers frequently use larger explicit radius utilities such as `rounded-xl`, `rounded-2xl` and `rounded-3xl`.

KAN-557 now provides semantic shape aliases over the existing radius scale. T3 may reconcile shared primitives against those aliases without creating additional parallel scales.

### Light/dark

`ThemeProvider` uses class-based theming with system default support. Both light and dark semantic variables already exist. KAN-507 should evolve these same semantic authorities rather than introduce a second theme source.

## Primitive inventory and ownership

### Base primitives

`components/ui/*` contains the shadcn/Base UI layer. Existing primitives include buttons, inputs, selects, checkboxes, dialogs, alert dialogs, sheets, tabs, accordions, sliders, badges, toggles, scroll areas, calendars, carousels and related controls.

This layer supplies low-level behavior and already contains useful accessibility behavior such as keyboard semantics and `focus-visible` treatment. KAN-507 must preserve that behavior when introducing EPT semantics.

### Official EPT semantic primitives

KAN-558 officializes a bounded subset of `components/ui/custom/*` as EPT semantic primitives. They remain built on top of the Base primitive layer and must not duplicate low-level interaction behavior already owned there.

Officialized semantic primitives:

- `CustomButton` and its approved semantic variants;
- `PrimaryInput`;
- `ThemeToggleButton`;
- `CustomCard`;
- `CustomCardInside`;
- `StatCard`;
- `PillButton`;
- `ConfirmActionDialog`.

Ownership rules:

- Base primitives keep keyboard semantics, `focus-visible`, disabled behavior and `aria-invalid` treatment;
- EPT semantic primitives consume Brand/semantic tokens, shared shape/spacing/elevation and accessible naming contracts;
- Athlete/mobile interactive wrappers use the shared minimum touch target `2.75rem` (44 px);
- decorative icons inside officialized wrappers are hidden from assistive technology when visible text or an explicit accessible name already conveys purpose;
- reusable wrappers do not own locale-specific presentation copy.

### Product patterns

Product patterns are reusable compositions with product-level meaning and interaction rules. They may compose Base primitives and EPT semantic primitives, but should not absorb feature-specific domain logic merely to reduce duplication.

Existing wrappers such as `StatPill`, `ZonePill`, `CardHeader` and `ProgressGradient` remain product-pattern candidates or legacy shared compositions until a later slice provides enough evidence to officialize them. KAN-558 does not promote them automatically.

### Feature compositions

Feature compositions remain owned by their workflow/surface. KAN-507 may touch a representative consumer to prove a shared contract, as with the Athlete theme toggle accessible label, but feature-level normalization belongs to KAN-508.

## Current debt classification

T1 records debt so later work can place it in the correct boundary; it does not silently fix all of it.

### KAN-507 foundation / primitive debt

Examples that remain for later KAN-507 slices when the shared contract is touched:

- direct presentation literals outside the officialized semantic primitives;
- legacy/shared wrappers that still combine behavior, product semantics and styling without enough evidence for promotion;
- inconsistent explicit text sizes in non-officialized shared/product compositions;
- application-level adoption gaps that belong to KAN-508 rather than this story.

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

## Responsive architecture

KAN-559 freezes two role-specific responsive strategies without changing information architecture.

### Coach desktop-first / progressive compression

Coach remains desktop-first and keeps its existing Sidebar information architecture. Narrow viewports compress shell density rather than introducing a second navigation model:

- the Sidebar remains collapsible to icon mode and keeps the same destinations;
- the shell header compresses before returning to the wider desktop height;
- content gutters and vertical density expand progressively from narrow → `sm` → `lg`;
- no Coach navigation mode is inferred from pathname.

This is **progressive compression**: the desktop composition is preserved while density is reduced deliberately as available width shrinks.

### Athlete mobile-first / progressive expansion

Athlete remains mobile-first and keeps a single information architecture of four destinations:

- Inicio / Home;
- Plan;
- Stats;
- Perfil / Profile.

Mobile keeps the full-width `BottomNavigationBar`. From the existing `sm` breakpoint at 640px, the same component becomes a compact persistent bottom bar centered in the viewport. This is **progressive expansion** of the mobile architecture, not a second navigation taxonomy.

A navigation rail was evaluated for KAN-358 and **not adopted** for KAN-507 because it would require maintaining a second spatial navigation representation and reserving a lateral content column without adding new information architecture value. The compact persistent bottom bar preserves discoverability and the exact same four destinations across mobile, mobile-landscape, tablet and desktop.

The Athlete navigation component may use pathname only to determine the active selection. Pathname does not decide responsive layout or navigation strategy; responsive composition remains CSS/layout-driven.

### Responsive composition vs accessibility scaling

Responsive composition and accessibility scaling remain independent concerns.

The historical Athlete readability baseline stays unchanged:

- mobile root scale: 120%;
- from 640px: 100%.

KAN-559 does not reinterpret those values as responsive navigation or density rules. Coach compression and Athlete expansion are composition decisions; the root font scaling remains the separate accessibility constraint defined by KAN-359 until later real-device evidence supports replacing it with an equivalent or better legibility model.

Reconciliation:

- **KAN-358** is resolved for KAN-507 by retaining one Athlete four-destination IA and selecting the compact persistent bottom bar for wide viewports instead of a navigation rail/sidebar.
- **KAN-359** is resolved for KAN-507 by explicitly separating semantic typography, responsive composition and accessibility scaling while preserving the existing 120% mobile / 100% from 640px root behavior.

## Responsive and accessibility boundaries

KAN-507 will define:

- Coach desktop-first composition with deliberate compression;
- Athlete mobile-first composition with deliberate expansion;
- one Athlete four-destination IA;
- WCAG 2.2 AA as the technical baseline for tokens/primitives/patterns KAN-507 defines or officializes;
- mobile/outdoor-appropriate Athlete touch targets.

KAN-507 is not a complete WCAG audit of every existing page. KAN-508 applies and verifies the shared contracts transversally.

## PWA and maps

### PWA contract

KAN-560 defines a **single PWA** for Coach and Athlete. Role resolution remains an application/auth concern after launch; the manifest does not split product identity by role.

The stable manifest identity is:

- `name`: El Parque Team;
- `short_name`: EPT;
- `id`, `start_url` and `scope`: `/`;
- `display`: `standalone`;
- `orientation`: `any`;
- categories: `sports`, `fitness`.

PWA presentation consumes the existing Brand foundations rather than creating an independent palette. Because a web app manifest cannot consume CSS custom properties directly, its color fields are serialized equivalents of the light application foundations:

- `theme_color` serializes `--brand-action`;
- `background_color` serializes the light `--background`.

These literals are transport/manifest serializations of the same Design System authority, not a second color source.

The existing 192×192 and 512×512 PNG install icons remain the current asset contract. KAN-560 does **not** mark them as `maskable` because no safe-zone evidence has been established for those files. Screenshots are also not fabricated merely to populate optional manifest fields.

Role-specific shortcuts remain deferred to KAN-298. KAN-560 therefore does not introduce Coach/Athlete shortcuts or parallel install identities.

### Maps

The cartographic decision is separate from the Design System authority.

KAN-561 resolves the approved **MapLibre-first** benchmark with the following minimum deterministic contract:

- one **single monocolor LineString**;
- GeoJSON coordinates remain `[lon, lat]`;
- `fitBounds` is calculated from the same benchmark coordinates;
- user pan/zoom does not trigger track reconstruction or refit;
- base-style replacement recreates the source/layer after `style.load` without refitting the route;
- container-size changes are observed with `ResizeObserver` and forwarded to `map.resize()`;
- MapLibre GL JS v6 uses an explicit worker URL under Next.js/Turbopack: `/maplibre/maplibre-gl-worker.mjs`;
- `predev` and `prebuild` copy both `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` from the installed package into `public/maplibre/`;
- normal component cleanup removes map listeners, disconnects the resize observer and removes the map instance.

The altitude gradient is **outside the minimum gate**. KAN-561 deliberately removes altitude-segment/color-expression behavior from the benchmark so cartographic stability is evaluated independently from optional styling complexity.

Runtime diagnosis with the Matagusanos GPX proved that the track input and bounds were valid while MapLibre stayed at `styleLoaded=false` and never reached `idle`. The source and line layer existed but the GeoJSON was not rendered until the worker was configured explicitly. After adding that worker integration, the same benchmark rendered the full LineString correctly in the manual walkthrough. MapLibre therefore remains the cartographic implementation for KAN-507.

The repository commit `61cf855de565ce53932b8153e9865a8919730747`, previously referenced as a historical Leaflet implementation during refinement, was re-inspected during closure and also contains MapLibre. It is therefore **not Leaflet evidence** and must not be used as such. If a future regression again makes MapLibre fail the minimum benchmark after reasonable integration defects are corrected, any Leaflet comparison must first locate a real Leaflet implementation and then apply the **same benchmark and identical criteria**.

## Consumption contract

The executable Design System remains Git-first and consumable without Figma or Storybook.

Use the existing import boundary deliberately:

- `app/globals.css` is the authority for foundations, semantic tokens, typography, spacing, shape, elevation, Brand roles and theme values.
- `@ui/*` resolves to `components/ui/*` and is the import surface for **Base primitives**.
- `@ui/custom/*` resolves inside `components/ui/custom/*` and is the current import surface for **Official EPT semantic primitives** and legacy/shared **Product patterns**.
- **Feature compositions** remain inside their owning feature/surface and may compose the layers above.

Physical co-location under `components/ui/custom/*` does not erase the conceptual ownership boundary. KAN-507 does not require a disruptive folder migration merely to mirror the conceptual stack. Promotion into an Official EPT semantic primitive is a contract decision, not a filename convention.

Consumers should prefer the highest stable layer that already owns the needed behavior:

```text
app/globals.css foundations/tokens
        ↓
@ui/* Base primitives
        ↓
@ui/custom/* Official EPT semantic primitives / shared product patterns
        ↓
feature-owned compositions
```

Do not bypass an officialized EPT semantic primitive only to restyle its Base primitive locally. Conversely, do not promote a feature-specific composition into `@ui/custom/*` solely to reduce duplication.

### KAN-508 migration boundary

KAN-508 owns transversal application of the contracts defined by KAN-507. Its migration boundary includes existing surfaces that still require normalization of:

- typography hierarchy;
- forms and controls;
- cards and surfaces;
- loading, empty and error states;
- responsive composition on remaining feature surfaces that have not yet been normalized against the KAN-507 role-specific shell and spacing contracts;
- direct presentation literals that should consume semantic tokens or officialized shared primitives.

KAN-508 may migrate consumers toward the existing semantic authority, but it must not reinterpret the foundations established here or create parallel token systems. Page-by-page cleanup remains outside KAN-507.

### Documentation and auxiliary tooling

Git documentation plus the executable code above are sufficient to identify the implementable Design System authority.

Figma remains auxiliary and does not override repository behavior.

Storybook is **not introduced** by KAN-562 because the current primitive set does not demonstrate a material need that outweighs the additional tooling and maintenance surface. This absence is not Design System debt; Storybook may be reconsidered later if isolated component development, regression evidence or collaboration needs become concrete.

Experimental external tooling remains outside this authority. Archify is outside the KAN-507 DoD and outside T1–T8, and it must not become a durable source of truth or leave required production/tooling dependencies.

## External tooling

Experimental external tooling is outside the KAN-507 Definition of Done.

The approved Archify pilot is temporary, unversioned, outside T1–T8 and cannot become an architectural authority or block story closure.
