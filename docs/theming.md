# FlexDoc theming

FlexDoc has a light/dark renderer and a persisted viewer appearance setting. Hosts can provide an initial mode and brand tokens; readers can select light, dark, or high contrast in Viewer Settings.

## Initial appearance

The React component accepts a light or dark host default:

```tsx
<FlexDoc spec={spec} theme="dark" />
```

Backend and native adapters expose the equivalent `theme` setting. Their default is adapter-specific, commonly `system` or `light`; the renderer receives a concrete light/dark mode from the host page.

The viewer preference is stored per documentation origin and API title. It overrides the host default until the reader resets it. High contrast uses system color keywords and is available from Viewer Settings.

## Brand configuration

Use `options.theme` with the exported `ThemeConfig` shape:

```tsx
<FlexDoc
  spec={spec}
  options={{
    theme: {
      colors: {
        primary: {
          main: '#0f766e',
          light: '#ccfbf1',
          dark: '#115e59',
        },
        text: {
          primary: '#172554',
          secondary: '#475569',
        },
        border: {
          light: '#cbd5e1',
          dark: '#334155',
        },
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '16px',
        lineHeight: '1.5',
        headings: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: '650',
        },
        code: {
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          wrap: true,
        },
      },
      sidebar: {
        backgroundColor: '#f8fafc',
        backgroundColorDark: '#0f172a',
        textColor: '#334155',
        textColorDark: '#cbd5e1',
        activeTextColor: '#0f766e',
        activeTextColorDark: '#5eead4',
      },
      methodColors: {
        get: { bg: '#dcfce7', border: '#16a34a' },
        post: { bg: '#dbeafe', border: '#2563eb' },
      },
    },
  }}
/>;
```

`ThemeConfig` supports:

- `colors.primary`, `colors.success`, and `colors.error`, each with `main`, `light`, and `dark`;
- `colors.text.primary` and `colors.text.secondary`;
- `colors.gray[50]` and `colors.gray[100]`;
- `colors.border.light` and `colors.border.dark`;
- `typography` root, heading, and code settings;
- light/dark sidebar colors and group-item text transform;
- per-method `bg` and `border` colors.

Unknown legacy theme keys and theme preset objects are not part of the 3.0 public contract. Importing `themes.material` or `themes.github` is not supported.

## Logo

`options.logo` accepts a URL string or `LogoOptions`:

```ts
logo: {
  url: '/brand/prauga.svg',
  alt: 'Prauga',
  maxHeight: 32,
  maxWidth: 180,
  padding: { vertical: 4, horizontal: 8 },
  backgroundColor: '#ffffff',
  clickable: true,
}
```

## Custom CSS and JavaScript

JavaScript hosts can provide `customCss` and `customJs`. Treat both as trusted application code. Prefer `ThemeConfig` for stable brand customization because renderer-internal class names are not a compatibility contract.

```ts
options: {
  customCss: '.flexdoc-root { --my-brand-token: #0f766e; }',
}
```

## Accessibility and print

- `prefers-reduced-motion` disables renderer animation and smooth scrolling.
- `prefers-contrast: more` and forced-colors environments receive stronger control outlines.
- Viewer Settings exposes a persistent high-contrast appearance.
- **Print operation** produces the operation reader layout while hiding interactive application chrome.

Brand overrides should preserve readable contrast in both light and dark modes and should not remove focus indicators.
