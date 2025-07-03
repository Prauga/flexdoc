# FlexDoc Theming Guide

FlexDoc provides extensive theming capabilities to match your brand identity. This guide explains how to customize the look and feel of your API documentation.

## Basic Theming

You can customize the basic colors of your documentation by providing a `theme` object in your FlexDoc configuration:

```typescript
const options = {
  // Other options...
  theme: {
    primaryColor: '#1976d2',
    secondaryColor: '#9c27b0',
    backgroundColor: '#ffffff',
    textColor: '#333333',
  },
};
```

## Theme Properties

| Property              | Type     | Default        | Description                                            |
| --------------------- | -------- | -------------- | ------------------------------------------------------ |
| `primaryColor`        | `string` | `'#1976d2'`    | The primary color used for buttons, links, and headers |
| `secondaryColor`      | `string` | `'#9c27b0'`    | The secondary color used for accents and highlights    |
| `backgroundColor`     | `string` | `'#ffffff'`    | The background color of the documentation              |
| `textColor`           | `string` | `'#333333'`    | The main text color                                    |
| `headingColor`        | `string` | `'#212121'`    | The color for headings                                 |
| `linkColor`           | `string` | `primaryColor` | The color for links                                    |
| `navbarColor`         | `string` | `primaryColor` | The color for the navigation bar                       |
| `navbarTextColor`     | `string` | `'#ffffff'`    | The text color for the navigation bar                  |
| `codeBackgroundColor` | `string` | `'#f5f5f5'`    | The background color for code blocks                   |
| `codeTextColor`       | `string` | `'#333333'`    | The text color for code blocks                         |
| `borderColor`         | `string` | `'#e0e0e0'`    | The color for borders                                  |
| `errorColor`          | `string` | `'#f44336'`    | The color for error messages                           |
| `successColor`        | `string` | `'#4caf50'`    | The color for success messages                         |
| `warningColor`        | `string` | `'#ff9800'`    | The color for warning messages                         |
| `infoColor`           | `string` | `'#2196f3'`    | The color for info messages                            |

## Advanced Theming

For more advanced customization, you can override specific components:

```typescript
const options = {
  // Other options...
  theme: {
    // Basic colors
    primaryColor: '#1976d2',

    // Component-specific overrides
    components: {
      header: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
      sidebar: {
        backgroundColor: '#f5f5f5',
        textColor: '#333333',
        width: '300px',
      },
      // ... other components
    },
  },
};
```

## Component Theming

### Header

```typescript
header: {
  backgroundColor: string,
  textColor: string,
  height: string,
  padding: string,
  borderBottom: string,
}
```

### Sidebar

```typescript
sidebar: {
  backgroundColor: string,
  textColor: string,
  width: string,
  activeItemBackgroundColor: string,
  activeItemTextColor: string,
  hoverBackgroundColor: string,
  groupHeadingColor: string,
}
```

### Content

```typescript
content: {
  backgroundColor: string,
  padding: string,
}
```

### Code Blocks

```typescript
codeBlock: {
  backgroundColor: string,
  textColor: string,
  fontSize: string,
  borderRadius: string,
  border: string,
}
```

### Buttons

```typescript
button: {
  primaryBackgroundColor: string,
  primaryTextColor: string,
  secondaryBackgroundColor: string,
  secondaryTextColor: string,
  borderRadius: string,
  hoverOpacity: number,
}
```

## Dark Mode

FlexDoc supports dark mode out of the box. You can provide a separate theme for dark mode:

```typescript
const options = {
  // Other options...
  theme: {
    // Light mode theme
    primaryColor: '#1976d2',
    // ...

    // Dark mode theme
    dark: {
      primaryColor: '#90caf9',
      backgroundColor: '#121212',
      textColor: '#ffffff',
      // ... other dark mode properties
    },
  },
};
```

## Theme Presets

FlexDoc comes with several built-in theme presets that you can use as a starting point:

```typescript
import { themes } from '@bluejeans/flexdoc';

const options = {
  // Other options...
  theme: themes.material, // or themes.github, themes.monokai, etc.
};
```

Available presets:

- `themes.default` - The default FlexDoc theme
- `themes.material` - Material Design inspired theme
- `themes.github` - GitHub inspired theme
- `themes.monokai` - Dark theme inspired by Monokai
- `themes.nord` - Cool blue theme inspired by Nord

## Custom CSS

For the most advanced customization, you can provide custom CSS:

```typescript
const options = {
  // Other options...
  customCss: `
    .flexdoc-header {
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .flexdoc-sidebar {
      border-right: 1px solid #e0e0e0;
    }
    
    /* ... other custom CSS */
  `,
};
```

## Example: Corporate Branding

Here's an example of how to theme FlexDoc to match your corporate branding:

```typescript
const options = {
  // Other options...
  theme: {
    primaryColor: '#00695c', // Company primary color
    secondaryColor: '#ffab00', // Company secondary color
    backgroundColor: '#ffffff',
    textColor: '#333333',
    components: {
      header: {
        backgroundColor: '#00695c',
        textColor: '#ffffff',
      },
      sidebar: {
        activeItemBackgroundColor: '#e0f2f1',
        activeItemTextColor: '#00695c',
      },
      button: {
        primaryBackgroundColor: '#00695c',
        secondaryBackgroundColor: '#ffab00',
      },
    },
    // Add company logo
    logo: {
      url: 'https://example.com/logo.png',
      altText: 'Company Logo',
      height: '40px',
    },
  },
};
```

For more examples, see the [Examples](../packages/examples) directory.
