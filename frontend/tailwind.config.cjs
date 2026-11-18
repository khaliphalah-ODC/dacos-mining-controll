module.exports = {
  "darkMode": "class",
  "content": { "relative": true, "files": [
    "./index.html",
    "./src/**/*.{vue,js}"
  ] },
  "plugins": [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
  "theme": {
    "extend": {
      "colors": {
        "surface-container": "#131f33",
        "surface-container-low": "#101928",
        "surface-container-high": "#1b2a45",
        "surface-container-highest": "#243552",
        "surface-container-lowest": "#080e18",
        "background": "#0a101d",
        "surface": "#0c1321",
        "primary": "#38bdf8",
        "primary-container": "#0284c7",
        "on-primary": "#002b40",
        "secondary": "#a5b4fc",
        "secondary-container": "#1e3a8a",
        "tertiary": "#4ade80",
        "tertiary-container": "#15803d",
        "error": "#f87171",
        "error-container": "#7f1d1d",
        "outline": "#64748b",
        "outline-variant": "#2a3c5a",
        "on-surface": "#f1f5f9",
        "on-surface-variant": "#94a3b8",
        "env-inverse-primary": "#006688",
        "env-on-tertiary-fixed-variant": "#005321",
        "env-surface-container-high": "#232a39",
        "env-background": "#0c1321",
        "env-on-secondary": "#002a78",
        "env-primary": "#92d9ff",
        "env-secondary-fixed-dim": "#b4c5ff",
        "env-on-tertiary-fixed": "#002109",
        "env-surface-container": "#19202e",
        "env-on-tertiary": "#003915",
        "env-inverse-on-surface": "#2a3040",
        "env-secondary-fixed": "#dbe1ff",
        "env-error": "#ffb4ab",
        "env-on-secondary-container": "#cdd7ff",
        "env-outline": "#86929a",
        "env-tertiary-fixed-dim": "#4ae176",
        "env-surface": "#0c1321",
        "env-error-container": "#93000a",
        "env-primary-fixed": "#c2e8ff",
        "env-surface-container-lowest": "#070e1c",
        "env-outline-variant": "#3d484f",
        "env-on-secondary-fixed-variant": "#003ea8",
        "env-on-error-container": "#ffdad6",
        "env-surface-bright": "#323949",
        "env-on-error": "#690005",
        "env-inverse-surface": "#dce2f6",
        "env-tertiary": "#56eb7e",
        "env-on-primary-fixed-variant": "#004d67",
        "env-tertiary-container": "#31ce66",
        "env-on-background": "#dce2f6",
        "env-surface-tint": "#75d1ff",
        "env-surface-container-low": "#151b2a",
        "env-tertiary-fixed": "#6bff8f",
        "env-on-surface": "#dce2f6",
        "env-primary-fixed-dim": "#75d1ff",
        "env-on-secondary-fixed": "#00174b",
        "env-surface-dim": "#0c1321",
        "env-on-tertiary-container": "#005221",
        "env-on-primary-fixed": "#001e2b",
        "env-on-surface-variant": "#bcc8d1",
        "env-surface-variant": "#2e3544",
        "env-on-primary-container": "#004c66",
        "env-on-primary": "#003548",
        "env-secondary-container": "#0053db",
        "env-surface-container-highest": "#2e3544",
        "env-secondary": "#b4c5ff",
        "env-primary-container": "#00c2ff"
      },
      "fontFamily": {
        "sans": [
          "Inter",
          "sans-serif"
        ],
        "mono": [
          "JetBrains Mono",
          "monospace"
        ],
        "headline-md": [
          "Inter"
        ],
        "headline-lg-mobile": [
          "Inter"
        ],
        "body-md": [
          "Inter"
        ],
        "headline-sm": [
          "Inter"
        ],
        "body-sm": [
          "Inter"
        ],
        "label-caps": [
          "Inter"
        ],
        "headline-lg": [
          "Inter"
        ],
        "body-lg": [
          "Inter"
        ],
        "mono-lg": [
          "JetBrains Mono"
        ],
        "display": [
          "Inter"
        ],
        "mono-sm": [
          "JetBrains Mono"
        ],
        "mono-md": [
          "JetBrains Mono"
        ]
      },
      "spacing": {
        "gutter-desktop": "1rem",
        "margin-desktop": "1.5rem",
        "space-sm": "0.5rem",
        "space-xl": "1.5rem",
        "space-lg": "1rem",
        "space-md": "0.75rem",
        "gutter": "0.75rem",
        "space-xs": "0.25rem",
        "margin": "1rem"
      },
      "fontSize": {
        "headline-md": [
          "18px",
          {
            "lineHeight": "24px",
            "fontWeight": "600"
          }
        ],
        "headline-lg-mobile": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "body-md": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "400"
          }
        ],
        "headline-sm": [
          "15px",
          {
            "lineHeight": "20px",
            "fontWeight": "600"
          }
        ],
        "body-sm": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "400"
          }
        ],
        "label-caps": [
          "10px",
          {
            "lineHeight": "12px",
            "letterSpacing": "0.06em",
            "fontWeight": "700"
          }
        ],
        "headline-lg": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "body-lg": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "mono-lg": [
          "18px",
          {
            "lineHeight": "22px",
            "letterSpacing": "0.01em",
            "fontWeight": "600"
          }
        ],
        "display": [
          "32px",
          {
            "lineHeight": "40px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "mono-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "letterSpacing": "0.02em",
            "fontWeight": "500"
          }
        ],
        "mono-md": [
          "13px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0",
            "fontWeight": "500"
          }
        ]
      }
    }
  }
};
