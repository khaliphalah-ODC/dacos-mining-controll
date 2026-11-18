---
name: Mission-Critical Mine Telemetry & Safety
colors:
  surface: '#0c1321'
  surface-dim: '#0c1321'
  surface-bright: '#323949'
  surface-container-lowest: '#070e1c'
  surface-container-low: '#151b2a'
  surface-container: '#19202e'
  surface-container-high: '#232a39'
  surface-container-highest: '#2e3544'
  on-surface: '#dce2f6'
  on-surface-variant: '#bcc8d1'
  inverse-surface: '#dce2f6'
  inverse-on-surface: '#2a3040'
  outline: '#86929a'
  outline-variant: '#3d484f'
  surface-tint: '#75d1ff'
  primary: '#92d9ff'
  on-primary: '#003548'
  primary-container: '#00c2ff'
  on-primary-container: '#004c66'
  inverse-primary: '#006688'
  secondary: '#b4c5ff'
  on-secondary: '#002a78'
  secondary-container: '#0053db'
  on-secondary-container: '#cdd7ff'
  tertiary: '#56eb7e'
  on-tertiary: '#003915'
  tertiary-container: '#31ce66'
  on-tertiary-container: '#005221'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c2e8ff'
  primary-fixed-dim: '#75d1ff'
  on-primary-fixed: '#001e2b'
  on-primary-fixed-variant: '#004d67'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#0c1321'
  on-background: '#dce2f6'
  surface-variant: '#2e3544'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
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
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.01em
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: '0'
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style
The design system delivers an industrial, mission-control aesthetic engineered for operators overseeing subterranean and surface mining personnel, autonomous machinery, and hazardous atmospheric conditions. Designed for high-stress, rapid-scanning environments, the interface minimizes ocular fatigue under low-light control room setups while ensuring instant visual triage of telemetry, environmental hazards, and emergency states.

The visual style blends **High-Density Industrial Utility** with **Tactical Futurism**:
- Razor-sharp division of data tiers with hairline structural framing.
- Zero ornamental distraction; aesthetic delight is derived strictly from hyper-legible telemetry readouts, status-coded micro-indicators, and spatial discipline.
- Deliberate semantic lighting: High-chroma signals cut through deep, cold slate fields only to report state, threshold limits, or directional focus.

## Colors
The palette is calibrated strictly for dark operational environments, balancing deep absorption layers with tactical luminescence.

### Palette Architecture
- **Canvas Base (`#0B1220`)**: Deep void navy. Absorbs peripheral light and forms the master background canvas.
- **Structural Chrome / Sidebar (`#111C2E`)**: Dark slate field establishing architectural boundaries, persistent navigation bars, and primary tool anchors.
- **Containers & Surfaces (`#172338`)**: Navy charcoal. Applied to cards, panels, and telemetry trays.
- **Interactive & Elevated Surface (`#1E2E47`)**: Hover states, active modal backdrops, and secondary elevated modules.
- **Border Definers (`#20304C`)**: Low-energy, precise borders separating dense data streams without visual clutter.
- **Primary Accent (`#00C2FF`)**: Electric Cyan. Reserved for active interactive targets, focus rings, selected tracks, and critical vector paths.
- **Secondary Accent (`#2563EB`)**: Industrial Blue. Used for secondary toggles, link anchors, systemic notifications, and non-emergency telemetry tracks.

### Semantic & Safety Tiers
- **Safe / Operational (`#22C55E`)**: Active air quality within threshold, nominal seismic activity, tracked worker vitals cleared.
- **Warning / Degraded (`#F59E0B`)**: Gas concentration threshold alert, maintenance due, ventilation fan pressure drop.
- **Critical / Emergency (`#EF4444`)**: Structural cave-in risk, toxic gas burst (CO/CH₄), automated evacuation alarms, emergency stop commands.

### Typography Neutrals
- **Primary Readout (`#F8FAFC`)**: Crisp optic white for high-priority numbers, titles, and emergency directives.
- **Secondary Readout (`#94A3B8`)**: Cool gray for descriptive labels, axes, and active metadata.
- **Tertiary & Muted (`#64748B`)**: Subdued slate for grid lines, disabled controls, unit denotations, and passive timestamps.

## Typography
Typography is divided strictly along functional lines: **Inter** handles narrative clarity, system statuses, commands, and navigational hierarchy; **JetBrains Mono** governs all dynamic machine readouts, spatial coordinates (X/Y/Z sub-shaft offsets), gas parts-per-million (PPM), seismic frequencies, and UTC incident clocks.

- Tabular figures (`tnum`) must be enforced globally on all numeric displays to prevent jitter during live streaming telemetry.
- All high-level subsystem tags use `label-caps` with uppercase transformation to simulate physical military/industrial control rack lettering.
- Never wrap or break telemetry identifiers across lines; enforce truncation with monospace tooltips if shaft space constraints demand.

## Layout & Spacing
Designed for extreme density, multi-monitor video walls, and ultrawide tactical consoles, the layout relies on a strict 12-column or 24-column fluid grid system with minimal internal padding to preserve maximum screen real estate.

### Density Architecture
- **Control Room Console (Desktop/Ultrawide)**: 24-column configuration with a persistent 280px left rail for mine sector navigation, top 48px global safety telemetry strip, and modular dynamic panels (Seismic 3D map, Atmospheric Array, Fleet Dispatches). Gutters remain tight at `1rem`.
- **Field Terminal (Tablet / Ruggedized Laptop)**: Collapses to a 12-column layout. The sector rail collapses into an iconified docked bar. Gutter drops to `0.75rem`.
- **Mobile Responder**: Strictly vertical single-column card stack. Subsystem priority surfaces warnings and critical nodes at the top, collapsing normal operations into a compact accordioned status line.

### Rhythm
Components follow a strict 4px base increment (`0.25rem`). Information density takes precedence over expansive negative space: micro-spacers (`space-xs` and `space-sm`) are the default spacing within telemetry modules, tables, and sensor matrices.

## Elevation & Depth
In an enterprise industrial telemetry UI, traditional fuzzy drop shadows create visual mud and impede instant data acquisition. Depth is communicated strictly through **tonal stratification** and **crisp optical borders**:

1. **Level 0 (Canvas Base)**: `#0B1220` with an optional micro-grid or subtle scanline background for operational framing.
2. **Level 1 (Docked Navigation / Rails)**: `#111C2E` framed with a right or bottom 1px solid `#20304C` border.
3. **Level 2 (Telemetry Cards & Monitoring Modules)**: `#172338` with an all-around 1px solid `#20304C` border.
4. **Level 3 (Interactive Hover / Target Locked State)**: `#1E2E47` accompanied by an accent border shift to `#00C2FF` or semantic alert colors.
5. **Level 4 (Floating Dialogs, E-Stop Overlays & Flyout Panels)**: Background `#172338` elevated via a 1px border of `#00C2FF` (or `#EF4444` in incident mode) combined with a hard directional ambient glow: `box-shadow: 0 0 24px -4px rgba(0, 194, 255, 0.15)`.

Backdrop blurs (`backdrop-filter: blur(8px)`) are permitted only on transient floating HUD overlays or modal safety confirmation dialogues.

## Shapes
The shape language conveys structural durability, physical console hardware, and precision engineering:
- Base radius is strictly **Soft (4px / 0.25rem)** across telemetry containers, system inputs, and interactive cards.
- Outer corner radius for modals and high-level viewport containers remains sharp or soft (`0.5rem` max).
- Status simulation badges and telemetry pills utilize a structured micro-radius (`2px` to `4px`) rather than full pill circular rounding, retaining an instrumentation look rather than a consumer appearance.
- Action icons and indicator diodes use strict geometric shapes: squares for operational nodes, inverted triangles for hazards, and diamonds for active personnel.

## Components

### Buttons & Tactical Triggers
- **Primary Action (System Engagement)**: Solid `#00C2FF` fill with `#0B1220` bold text. On hover, background shifts to `#38D0FF` with a subtle `0 0 12px rgba(0,194,255,0.4)` glow.
- **Secondary Action (Subsystem Config)**: Border-only (`#20304C`), background transparent, text `#F8FAFC`. On hover, surface becomes `#1E2E47` and border illuminates to `#00C2FF`.
- **Hazard / Emergency Action (E-Stop, Ventilation Override)**: Background `#EF4444` with crisp white text. Active states trigger an animated pulsating outer rim.

### Telemetry Cards & Simulation Modules
- Framed in `#172338` with a 1px `#20304C` border.
- Headers feature a condensed status ribbon: a 2px vertical color bar on the left edge indicating local sub-shaft state (Safe: `#22C55E`, Warning: `#F59E0B`, Danger: `#EF4444`).
- Data clusters inside cards feature a mono label on top (`label-caps`, `#94A3B8`) with a massive numeric sensor readout underneath (`mono-lg`, `#F8FAFC`).

### Telemetry Status Pills & Simulation Badges
- Structured container with 2px corner radius.
- Background uses a 10% opacity tint of the semantic color with a 1px solid border at 40% opacity (e.g., Critical Alert: background `rgba(239, 68, 68, 0.1)`, border `rgba(239, 68, 68, 0.4)`, text `#EF4444`).
- Leading visual beacon: A 6px pulsing circular diode indicating live data streaming heartbeat.

### Data Tables & Sensor Logs
- High density: 32px row height.
- Alternating subtle striping (`#111C2E` and `#172338`) with border-bottom in `#20304C`.
- Text adheres to `mono-sm` for timestamps and values, with `body-sm` for location descriptions and personnel names.
- Hovering a row highlights it with `#1E2E47` and a left border accent in `#00C2FF`.

### Input Fields & Tactical Steppers
- Input containers feature `#111C2E` background, 1px `#20304C` border, and text `#F8FAFC` in `JetBrains Mono`.
- Active focus state: Border color changes immediately to `#00C2FF` with zero delay.
- Placeholder text is muted `#64748B`.

### Checkboxes & Toggle Switches
- Checkboxes: 16x16px square with 2px radius. Border `#20304C`. When selected, filled with `#00C2FF` displaying an angled dark tick.
- Toggles: Industrial rack-switch profile. 36px width, 18px height. Rail is `#111C2E` with `#20304C` border; the thumb switch slides smoothly to reveal an illuminated `#00C2FF` or `#22C55E` live track.