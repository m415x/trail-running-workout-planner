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
