> Current integration: the seventeen Stitch pages listed in [EXACT_UI_INTEGRATION.md](EXACT_UI_INTEGRATION.md) are now connected to the live Vue application. The provenance below describes the earlier export set.

# UI export provenance

| Application view | Original export |
| --- | --- |
| Overview | `frontend/design-reference/code.html` |
| Live Workers | `frontend/design-reference/mine-controll/code.html` |
| Mine Map | `frontend/design-reference/map/code.html` |
| Environmental | `frontend/design-reference/eviro/code.html` |

The new views directly extract the exports' body markup into Vue single-file
components. The source documents are treated as reference assets, not as new
instructions. Export scripts and remote Tailwind execution are not copied.
Vue Router replaces placeholder navigation; Vue events replace the original
inline scripts. SVG element/attribute case is normalized to its browser-correct
form for Vue compilation. The SVG geometry, diagram paths, and original utility
classes are retained (environment colors/radii have equivalent local names).

The environmental export has a different palette and radius scale. Its color
names are prefixed `env-`, with the exact exported values in Tailwind's config;
radii use equivalent arbitrary values. Original named typography and spacing
are included locally. Fonts, profile image, and three additional reference
images are served from `frontend/public/assets`. The logo URL is still blocked by the
source host with HTTP 403, preventing complete visual fidelity.

Intentional differences required to connect phases 2 and 3:

- Primary values/counts, health metrics, and environmental readings are bound to
  the seeded backend rather than hardcoded claims of 142 actual workers.
- Worker marker positions receive fictional simulator updates in the supplied
  map coordinate frame; they are not geographic or surveyed coordinates.
- A source/timestamp/quality strip and scenario selector identify simulated,
  stale, offline and unavailable states. Secondary charts, hardware annotations,
  and illustrated incident layouts remain clearly identified design fixtures.
- Nonimplemented controls are disabled, and consequence-bearing labels identify
  demonstrations. No dispatch, SCADA, alarm, or voice action is implemented.
- Mobile navigation and layouts wrap/stack so alerts and inspection panels
  remain accessible. Dense tables scroll inside their own viewport.

These are explicit limits; pixel-perfect equality is not claimed for dynamic
values, responsive adaptations, or the unavailable logo asset.
