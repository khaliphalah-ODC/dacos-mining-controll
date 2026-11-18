---
name: DACOS Industrial Mission Interface
colors:
  surface: '#011427'
  surface-dim: '#011427'
  surface-bright: '#293a4f'
  surface-container-lowest: '#000f20'
  surface-container-low: '#091d30'
  surface-container: '#0d2134'
  surface-container-high: '#192b3f'
  surface-container-highest: '#24364a'
  on-surface: '#d1e4fe'
  on-surface-variant: '#bbcac6'
  inverse-surface: '#d1e4fe'
  inverse-on-surface: '#203246'
  outline: '#859491'
  outline-variant: '#3c4947'
  surface-tint: '#4bdbcb'
  primary: '#4bdbcb'
  on-primary: '#003732'
  primary-container: '#00b8a9'
  on-primary-container: '#00423c'
  inverse-primary: '#006a61'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e49200'
  on-tertiary-container: '#543300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6df8e7'
  primary-fixed-dim: '#4bdbcb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#011427'
  on-background: '#d1e4fe'
  surface-variant: '#24364a'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  telemetry-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0.01em
  telemetry-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  code-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an operational interface for heavy industrial mining, environmental telemetry, and real-time site monitoring deployed in rugged field environments such as Liberia's extraction corridors. The UI communicates relentless reliability, operational sobriety, and tactical clarity under adverse physical conditions (high ambient glare, dust-covered field tablets, low-bandwidth satellite links, and multi-shift cognitive fatigue).

The aesthetic merges **Utilitarian Modernism** with **Mission-Critical SCADA telemetry**. It prioritizes immediate situational awareness over visual ornamentation. Visual noise is aggressively eliminated; every pixel, border, and luminance shift denotes functional state or operational status. Given the active prototype validation context, the interface enforces high-visibility industrial disclaimer markers and status banners across active monitoring canvases to clearly delineate simulated telemetry from certified field instrumentation.

## Colors

The palette is engineered strictly for low-light control rooms, industrial cabs, and field ruggedized screens under variable exterior sunlight. It utilizes a high-contrast dark foundation anchored by stratified deep navies, preventing eye strain while creating maximum luminous separation for alert vectors.

### Surface Tiers
- **Canvas Base (`#071B2E`)**: Deepest substrate; hosts global viewport frames and main app canvasing.
- **Surface Elevation 1 (`#0A2239`)**: Structural headers, navigation docks, and fixed monitoring rails.
- **Card & Container Surfaces (`#0E2A47` to `#133558`)**: Analytical modules, telemetry tiles, and payload clusters.
- **Structural Outlines (`#1E466E`)**: High-precision boundary definitions for modules, cards, and interactive groups.

### Interactive & Status Accents
- **Teal Accent (`#00B8A9`, Hover `#009E91`, Wash `rgba(0, 184, 169, 0.15)`)**: Primary actions, verified operations, selected navigation targets, and telemetry toggles.
- **Operational Red (`#EF4444`)**: Critical hazards, dynamic perimeter incursions, structural stress breaches, and irreversible commands.
- **Precautionary Amber (`#F59E0B`)**: Telemetry latency, unverified sensor sync, stale network packages, and non-blocking hardware warnings.
- **Connectivity Emerald (`#10B981`)**: Dedicated exclusively to hardware handshake, network availability, and active telemetry pings. *System Rule: Green strictly validates link connectivity and device power; it must never be visually coupled to infer certified human physical safety.*

### Typography & Content Readout
- **High-Contrast Text (`#F1F5F9`, `#FFFFFF`)**: Primary metrics, critical labels, and critical alert readouts.
- **Secondary Neutral (`#94A3B8`)**: Operational descriptions, baseline field values, and unit denominators.
- **Metadata Slate (`#64748B`)**: Timestamps, device identifiers, coordinate headers, and inactive schema indicators.

## Typography

The typographic hierarchy is executed entirely in **Inter**, selected for its neutral geometric legibility, wide aperture design, and high rendering fidelity on rugged low-DPI displays.

### Numeric & Metric Display
All telemetry streams, coordinate matrices, gas concentrations, seismic figures, and machine uptime records must enforce tabular numbers (`font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1`). This eliminates horizontal jitter when real-time updates stream into data tables and visual instruments.

### Text Contrast & Weight Discipline
- Headings use semi-bold (`600`) and bold (`700`) weights to produce clean semantic anchors across multi-column cockpits.
- Operational and technical metadata (sensor MAC addresses, node protocols, GPS timestamps) employ uppercase formatting with generous tracking (`0.04em` to `0.06em`) in the `label-sm` or `code-sm` tiers to ensure instant scanability.
- Body text maintains a generous 1.5x to 1.57x line height to prevent fatigue during extended shift operations.

## Layout & Spacing

The layout is structured upon an **8px base grid** optimized for persistent telemetry monitoring and rapid visual triage. It utilizes a fluid 12-column grid system for large-screen control desks, collapsing systematically into adaptive 8-column and 4-column layouts for ruggedized in-cab tablets and field mobility units.

### Form Factor Adaptations
- **Desktop / Wall Displays (> 1200px)**: 12-column grid; fixed 280px left telemetry navigation; 24px gutters; multi-pane layout displaying geofencing maps, gas-level trends, and incident dispatch consoles side by side.
- **Field Tablets (768px – 1199px)**: 8-column grid; collapsible off-canvas navigation rail; 16px gutters; 16px margins; panels stack into two primary columns with priority given to map telemetry and critical threshold alerts.
- **Mobile / Rugged Handhelds (< 767px)**: 4-column layout; single-column flow; 12px or 16px margins; non-essential secondary telemetry is tucked beneath expanders; prototype status banners stay docked to the viewport top.

### Spacing Principles
Component density remains high yet breathable (`space-sm` for related internal labels and data values; `space-md` between functional control groups). Canvas margins lock external bounds away from physical bezel edges of ruggedized hardware enclosures.

## Elevation & Depth

To preserve interface speed, reduce GPU overhead on low-power industrial devices, and maintain maximum contrast in direct sunlight, this design system rejects heavy blurs and decorative drop shadows in favor of **structural tonal layering** coupled with **precise low-contrast borders**.

### Layer Architecture
- **Layer 0 (Canvas Base - `#071B2E`)**: The ground plane.
- **Layer 1 (Sub-surface Panels - `#0A2239`)**: Fixed headers, system health bands, and drawer underlays.
- **Layer 2 (Functional Containers & Cards - `#0E2A47`)**: Standard operational cards, charts, and tables. Border: 1px solid `#1E466E`.
- **Layer 3 (Floating Overlays & Elevated Modals - `#133558`)**: Sensor drilldowns, manual override drawers, and active warnings. Border: 1px solid `#2A5A8C`. Drop shadow is restricted to a tight, ambient dark wash: `0 8px 24px rgba(2, 10, 18, 0.6)`.

### Operational Glows & Active State Lighting
Critical alert badges and active status indicators do not use blurred elevation shadows. Instead, emergency vectors apply a high-contrast 1px perimeter ring or a concentrated inner accent line (e.g., `#EF4444` for red alerts) to immediately catch the operator’s eye without softening the layout.

## Shapes

The design system enforces a disciplined, utilitarian corner treatment (`roundedness: 2`, where base components use `0.5rem` / `8px` corner radius, while large diagnostic modules and alert trays scale to `1rem` / `16px`).

This controlled curvature prevents the interface from feeling raw or unrefined like archaic terminal software, while avoiding overly bubbly consumer styles that compromise valuable grid screen area in dense telemetry matrices. 

- **Data Cells & Inputs**: `8px` (`0.5rem`)
- **Metric Cards & Modals**: `12px` to `16px` (`0.75rem` to `1rem`)
- **Prototype Badges & Telemetry Pills**: Fully rounded pill shapes (`9999px`) to create clear geometric contrast against rectangular data modules.

## Components

### Buttons & Interactive Controls
- **Primary Operational Button**: Background `#00B8A9`, text `#071B2E` (high-contrast deep navy), font-weight `600`, radius `8px`. Hover: `#009E91`. Focus ring: 2px offset `#00B8A9`.
- **Secondary Button**: Background `transparent`, border `1px solid #1E466E`, text `#F1F5F9`. Hover: background `rgba(30, 70, 110, 0.4)`, border `#00B8A9`.
- **Destructive/Emergency Action**: Background `#EF4444`, text `#FFFFFF`. Hover: `#DC2626`.
- **Minimum Touch Targets**: All interactive elements maintain a minimum target area of 44x44px for gloved-hand usability on industrial touchscreens.

### Prototype Status Badges (Mandatory)
- **Supervised Demo Banner**: Placed prominently across global viewport headers. Background `rgba(245, 158, 11, 0.15)`, border `1px solid #F59E0B`, text `#F59E0B`, typography `code-sm`, all-caps: `SUPERVISED DEMO PROTOTYPE`.
- **Simulation Indicators**: Attached directly to real-time streams where field telemetry is simulated. Background `rgba(100, 116, 139, 0.2)`, border `1px solid #64748B`, text `#94A3B8`, typography `code-sm`: `FICTIONAL SIMULATION // HW PENDING`.

### Telemetry Cards & Metric Containers
- Surface `#0E2A47` enclosed by a 1px border `#1E466E`. Padding `16px` (`space-md`).
- Header area houses sensor identity, site coordinates, and ping frequency in `#64748B`.
- Value display uses tabular figures at `telemetry-lg` or `telemetry-md` in `#F1F5F9`.
- Dynamic status stripe: 4px solid left border indicates module status (Emerald for active ping, Amber for stale reading, Red for threshold trip).

### Chips & Status Indicators
- **Hardware Link Active**: Background `rgba(16, 185, 129, 0.15)`, border `1px solid #10B981`, text `#10B981`. Includes a pulsing 6px circular dot. Explicit label specifies `NET LINK: UP` (never "WORKER SAFE").
- **Stale Telemetry**: Background `rgba(245, 158, 11, 0.15)`, border `1px solid #F59E0B`, text `#F59E0B`. Label: `SYNC DELAYED > 120s`.
- **Critical Violation**: Background `rgba(239, 68, 68, 0.2)`, border `1px solid #EF4444`, text `#EF4444`. Label: `ZONE ALERT: METHANE 4.2%`.

### Input Fields & Selectors
- Background `#0A2239`, border `1px solid #1E466E`, text `#F1F5F9`, placeholder `#64748B`.
- Focused state: border `1px solid #00B8A9`, box-shadow `0 0 0 2px rgba(0, 184, 169, 0.2)`.
- Input fields display concise unit-of-measure suffixes (e.g., `PPM`, `BAR`, `M/S`) locked in `label-sm` slate text on the right interior edge.

### Data Tables & Logs
- Header row uses `#0A2239` background, uppercase `code-sm` typography in `#64748B`, and a bottom border `1px solid #1E466E`.
- Rows feature alternating surface tints (`#0E2A47` / `#0C253F`), cell height `48px`, and tabular telemetry values.
- Incident logs highlight rows with a 2px left border accent corresponding to the severity color.