# Styling and Colors

## Color Management

### Golden Rule

**NEVER hardcode hex/rgb values directly in components. ALL colors MUST be defined as constants.**

### Color Constants Location

All colors MUST be defined in `src/constants/colors.ts`

### Color Constants Pattern

```typescript
// src/constants/colors.ts

export const COLORS = {
  // ============================================
  // PRIMARY COLORS
  // ============================================
  PRIMARY: '#6B46C1',
  PRIMARY_LIGHT: '#9F7AEA',
  PRIMARY_DARK: '#553C9A',
  PRIMARY_HOVER: '#805AD5',
  
  // ============================================
  // SECONDARY COLORS
  // ============================================
  SECONDARY: '#38B2AC',
  SECONDARY_LIGHT: '#81E6D9',
  SECONDARY_DARK: '#2C7A7B',
  
  // ============================================
  // NEUTRAL COLORS
  // ============================================
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  
  // Gray scale
  GRAY_50: '#F9FAFB',
  GRAY_100: '#F7FAFC',
  GRAY_200: '#EDF2F7',
  GRAY_300: '#E2E8F0',
  GRAY_400: '#CBD5E0',
  GRAY_500: '#A0AEC0',
  GRAY_600: '#718096',
  GRAY_700: '#4A5568',
  GRAY_800: '#2D3748',
  GRAY_900: '#1A202C',
  
  // ============================================
  // SEMANTIC COLORS
  // ============================================
  SUCCESS: '#48BB78',
  SUCCESS_LIGHT: '#9AE6B4',
  SUCCESS_DARK: '#276749',
  
  ERROR: '#F56565',
  ERROR_LIGHT: '#FEB2B2',
  ERROR_DARK: '#C53030',
  
  WARNING: '#ED8936',
  WARNING_LIGHT: '#FBD38D',
  WARNING_DARK: '#C05621',
  
  INFO: '#4299E1',
  INFO_LIGHT: '#90CDF4',
  INFO_DARK: '#2B6CB0',
  
  // ============================================
  // BACKGROUND COLORS
  // ============================================
  BACKGROUND_PRIMARY: '#FFFFFF',
  BACKGROUND_SECONDARY: '#F7FAFC',
  BACKGROUND_TERTIARY: '#EDF2F7',
  BACKGROUND_DARK: '#1A202C',
  
  // ============================================
  // TEXT COLORS
  // ============================================
  TEXT_PRIMARY: '#1A202C',
  TEXT_SECONDARY: '#718096',
  TEXT_MUTED: '#A0AEC0',
  TEXT_INVERSE: '#FFFFFF',
  TEXT_LINK: '#4299E1',
  
  // ============================================
  // BORDER COLORS
  // ============================================
  BORDER_DEFAULT: '#E2E8F0',
  BORDER_FOCUS: '#4299E1',
  BORDER_ERROR: '#F56565',
  
  // ============================================
  // OVERLAY COLORS
  // ============================================
  OVERLAY: 'rgba(0, 0, 0, 0.5)',
  OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.3)',
  
} as const;

// Type for color keys
export type ColorKey = keyof typeof COLORS;

// Type for color values
export type ColorValue = typeof COLORS[ColorKey];
```

### Adding New Colors

When you need a new color:

1. **Add to `COLORS` constant first**
2. Use descriptive, semantic names
3. Group with related colors
4. Never use hex values directly in components

```typescript
// ✅ Good: Add to constants first
// In colors.ts
HIGHLIGHT_YELLOW: '#FEFCBF',
HIGHLIGHT_GREEN: '#C6F6D5',

// Then use in component
<span style={{ backgroundColor: COLORS.HIGHLIGHT_YELLOW }}>highlighted</span>

// ❌ Bad: Hardcoded color
<span style={{ backgroundColor: '#FEFCBF' }}>highlighted</span>
```

## Usage in Components

### Inline Styles

```typescript
import { COLORS } from '@/constants/colors';

const MyComponent: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: COLORS.BACKGROUND_PRIMARY,
        color: COLORS.TEXT_PRIMARY,
        borderColor: COLORS.BORDER_DEFAULT,
        border: `1px solid ${COLORS.BORDER_DEFAULT}`,
      }}
    >
      <h1 style={{ color: COLORS.PRIMARY }}>Title</h1>
      <p style={{ color: COLORS.TEXT_SECONDARY }}>Description</p>
    </div>
  );
};
```

### Style Objects

```typescript
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS } from '@/constants/styles';

const styles = {
  container: {
    backgroundColor: COLORS.BACKGROUND_PRIMARY,
    borderRadius: BORDER_RADIUS.LARGE,
    padding: '24px',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: '24px',
    fontWeight: 'bold',
  },
  description: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: '16px',
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    color: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: '12px 24px',
    border: 'none',
    cursor: 'pointer',
  },
  buttonHover: {
    backgroundColor: COLORS.PRIMARY_HOVER,
  },
};
```

### CSS Modules with CSS Variables

```typescript
// Component.tsx
import { COLORS } from '@/constants/colors';
import styles from './Component.module.css';

const Component: React.FC = () => {
  const cssVars = {
    '--color-primary': COLORS.PRIMARY,
    '--color-text': COLORS.TEXT_PRIMARY,
    '--color-bg': COLORS.BACKGROUND_PRIMARY,
  } as React.CSSProperties;

  return (
    <div className={styles.container} style={cssVars}>
      <h1 className={styles.title}>Title</h1>
    </div>
  );
};
```

```css
/* Component.module.css */
.container {
  background-color: var(--color-bg);
  padding: 24px;
}

.title {
  color: var(--color-primary);
}
```

## Border Radius

### Border Radius Constants

```typescript
// src/constants/styles.ts

export const BORDER_RADIUS = {
  /** Cards, modals, panels, large containers */
  LARGE: '30px',
  
  /** Buttons, inputs, dropdowns */
  MEDIUM: '10px',
  
  /** Badges, tags, chips, small elements */
  SMALL: '6px',
  
  /** Circular elements (avatars, icons) */
  ROUND: '50%',
  
  /** No border radius */
  NONE: '0px',
} as const;

export type BorderRadiusKey = keyof typeof BORDER_RADIUS;
```

### Border Radius Usage

| Element Type | Constant | Value |
|--------------|----------|-------|
| Cards | `BORDER_RADIUS.LARGE` | 30px |
| Modals | `BORDER_RADIUS.LARGE` | 30px |
| Panels | `BORDER_RADIUS.LARGE` | 30px |
| Containers | `BORDER_RADIUS.LARGE` | 30px |
| Buttons | `BORDER_RADIUS.MEDIUM` | 10px |
| Inputs | `BORDER_RADIUS.MEDIUM` | 10px |
| Dropdowns | `BORDER_RADIUS.MEDIUM` | 10px |
| Badges | `BORDER_RADIUS.SMALL` | 6px |
| Tags | `BORDER_RADIUS.SMALL` | 6px |
| Chips | `BORDER_RADIUS.SMALL` | 6px |
| Avatars | `BORDER_RADIUS.ROUND` | 50% |

### Examples

```typescript
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS } from '@/constants/styles';

// Card - 30px radius
const cardStyle = {
  backgroundColor: COLORS.BACKGROUND_PRIMARY,
  borderRadius: BORDER_RADIUS.LARGE,
  padding: '24px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

// Button - 10px radius
const buttonStyle = {
  backgroundColor: COLORS.PRIMARY,
  color: COLORS.WHITE,
  borderRadius: BORDER_RADIUS.MEDIUM,
  padding: '12px 24px',
  border: 'none',
};

// Input - 10px radius
const inputStyle = {
  backgroundColor: COLORS.WHITE,
  borderRadius: BORDER_RADIUS.MEDIUM,
  border: `1px solid ${COLORS.BORDER_DEFAULT}`,
  padding: '12px 16px',
};

// Badge - 6px radius
const badgeStyle = {
  backgroundColor: COLORS.PRIMARY_LIGHT,
  color: COLORS.PRIMARY_DARK,
  borderRadius: BORDER_RADIUS.SMALL,
  padding: '4px 8px',
  fontSize: '12px',
};
```

## Spacing Constants (Optional)

```typescript
// src/constants/styles.ts

export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  XXL: '48px',
} as const;

export const FONT_SIZE = {
  XS: '12px',
  SM: '14px',
  MD: '16px',
  LG: '18px',
  XL: '24px',
  XXL: '32px',
} as const;
```

## Complete Constants File

```typescript
// src/constants/styles.ts

export const BORDER_RADIUS = {
  LARGE: '30px',
  MEDIUM: '10px',
  SMALL: '6px',
  ROUND: '50%',
  NONE: '0px',
} as const;

export const SPACING = {
  XS: '4px',
  SM: '8px',
  MD: '16px',
  LG: '24px',
  XL: '32px',
  XXL: '48px',
} as const;

export const FONT_SIZE = {
  XS: '12px',
  SM: '14px',
  MD: '16px',
  LG: '18px',
  XL: '24px',
  XXL: '32px',
} as const;

export const FONT_WEIGHT = {
  NORMAL: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700,
} as const;

export const SHADOW = {
  SM: '0 1px 2px rgba(0, 0, 0, 0.05)',
  MD: '0 4px 6px rgba(0, 0, 0, 0.1)',
  LG: '0 10px 15px rgba(0, 0, 0, 0.1)',
  XL: '0 20px 25px rgba(0, 0, 0, 0.15)',
} as const;

export const TRANSITION = {
  FAST: '150ms ease',
  NORMAL: '250ms ease',
  SLOW: '350ms ease',
} as const;
```

## Barrel Export

```typescript
// src/constants/index.ts

export * from './colors';
export * from './styles';
```

## Best Practices

### 1. Never Hardcode Colors

```typescript
// ✅ Good
<div style={{ backgroundColor: COLORS.PRIMARY }}>

// ❌ Bad
<div style={{ backgroundColor: '#6B46C1' }}>
```

### 2. Use Semantic Color Names

```typescript
// ✅ Good: Semantic names
COLORS.ERROR          // For error states
COLORS.SUCCESS        // For success states
COLORS.TEXT_PRIMARY   // For main text

// ❌ Bad: Non-semantic names
COLORS.RED            // What is it for?
COLORS.DARK_TEXT      // Not clear if primary/secondary
```

### 3. Group Related Styles

```typescript
// ✅ Good: Grouped style object
const cardStyles = {
  container: {
    backgroundColor: COLORS.BACKGROUND_PRIMARY,
    borderRadius: BORDER_RADIUS.LARGE,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
  },
};

// Usage
<div style={cardStyles.container}>
  <h1 style={cardStyles.title}>Title</h1>
</div>
```

### 4. Consistent Border Radius

```typescript
// ✅ Good: Use constants
borderRadius: BORDER_RADIUS.LARGE    // 30px for cards
borderRadius: BORDER_RADIUS.MEDIUM   // 10px for buttons

// ❌ Bad: Inconsistent values
borderRadius: '25px'   // Non-standard
borderRadius: '15px'   // Non-standard
```

## CSS Files - STRICT RULES

### ⚠️ CRITICAL: Never Use Hardcoded Colors in CSS Files

**NEVER use hex colors, rgb(), or rgba() directly in CSS files.**

### CSS Variable System

All colors in CSS files MUST use CSS custom properties (variables) that reference `src/constants/colors.ts`.

#### For Shadow DOM CSS Files

1. **Import color variables** from `src/constants/colors.css.ts`:
   ```typescript
   import { FAB_COLOR_VARIABLES } from '../constants/colors.css';
   ```

2. **Inject variables** into Shadow DOM before component styles:
   ```typescript
   injectStyles(shadow, FAB_COLOR_VARIABLES);
   injectStyles(shadow, componentStyles);
   ```

3. **Use variables** in CSS:
   ```css
   /* ✅ Good */
   .button {
     background: var(--color-white);
     border: 2px solid var(--color-primary-light);
     color: var(--color-primary);
   }
   
   /* ❌ BAD - Never do this */
   .button {
     background: #FFFFFF;
     border: 2px solid #BF7EFA;
     color: #9527F5;
   }
   
   /* ❌ BAD - Never use rgba() */
   .button {
     box-shadow: 0 4px 12px rgba(149, 39, 245, 0.35);
   }
   ```

#### For CSS Module Files

1. **Define CSS variables** at `:host` or `:root` level (values from constants):
   ```css
   :host {
     --color-primary: var(--color-primary, #9527F5);
     --color-primary-light: var(--color-primary-light, #BF7EFA);
     --color-white: var(--color-white, #FFFFFF);
   }
   ```

2. **Use variables** throughout the CSS:
   ```css
   .actionButton {
     background: var(--color-white);
     border: 2px solid var(--color-primary-light);
   }
   ```

### Color Variable Naming Convention

CSS variables should follow this pattern:
- `--color-primary` → `COLORS.PRIMARY`
- `--color-primary-light` → `COLORS.PRIMARY_LIGHT`
- `--color-white` → `COLORS.WHITE`
- `--color-gray-600` → `COLORS.GRAY_600`

### Creating New Color Variables

1. **Add to `src/constants/colors.ts`** first
2. **Export in `src/constants/colors.css.ts`** as CSS variable
3. **Use in CSS files** via `var(--color-name)`

### Examples of What NOT to Do

```css
/* ❌ NEVER hardcode hex */
.button {
  background: #9527F5;
  color: #FFFFFF;
}

/* ❌ NEVER use rgba() with hardcoded values */
.shadow {
  box-shadow: 0 4px 12px rgba(149, 39, 245, 0.35);
}

/* ❌ NEVER use rgb() */
.text {
  color: rgb(149, 39, 245);
}
```

### Examples of What TO Do

```css
/* ✅ ALWAYS use CSS variables */
.button {
  background: var(--color-primary);
  color: var(--color-white);
}

/* ✅ For shadows, use transparent or remove */
.shadow {
  box-shadow: none;
  /* Or use CSS variable if opacity variant exists */
}

/* ✅ For semi-transparent, define in constants first */
.overlay {
  background: var(--color-overlay);
}
```

### Enforcement

- All CSS files will be checked for hardcoded color values
- Use CSS variables from `src/constants/colors.css.ts`
- Document color mappings in CSS comments
- Update both `.module.css` and `.shadow.css` files when changing colors

## Font Family - STRICT RULES

### ⚠️ CRITICAL: Always Use Inter Font

**NEVER hardcode font-family values. ALWAYS use the FONT_FAMILY constant.**

### Font Family Constant

The font family is defined in `src/constants/styles.ts`:

```typescript
export const FONT_FAMILY = {
  PRIMARY: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;
```

### Usage in CSS Files

**ALWAYS use the CSS variable `var(--font-family-primary)` in CSS files:**

```css
/* ✅ Good */
:host {
  font-family: var(--font-family-primary);
}

body {
  font-family: var(--font-family-primary);
}

.button {
  font-family: var(--font-family-primary);
}

/* ❌ BAD - Never do this */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.button {
  font-family: 'Inter', sans-serif;
}
```

### For Shadow DOM CSS Files

1. **Color CSS variables** (including font-family) are injected via `src/constants/colors.css.ts`
2. **Use the variable** directly:
   ```css
   :host {
     font-family: var(--font-family-primary);
   }
   ```

### For Regular CSS Files

1. **Define in `:root`** (in `index.css` or component CSS):
   ```css
   :root {
     --font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
   }
   ```

2. **Use the variable**:
   ```css
   .component {
     font-family: var(--font-family-primary);
   }
   ```

### Font Family Variable Location

- **Constant**: `src/constants/styles.ts` → `FONT_FAMILY.PRIMARY`
- **CSS Variable**: `--font-family-primary`
- **Injected via**: `src/constants/colors.css.ts` → `FAB_COLOR_VARIABLES`

### Examples of What NOT to Do

```css
/* ❌ NEVER hardcode font-family */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ❌ NEVER use partial font stack */
.button {
  font-family: 'Inter', sans-serif;
}

/* ❌ NEVER use different fonts */
.title {
  font-family: 'Arial', sans-serif;
}
```

### Examples of What TO Do

```css
/* ✅ ALWAYS use CSS variable */
body {
  font-family: var(--font-family-primary);
}

/* ✅ With fallback for safety */
.component {
  font-family: var(--font-family-primary, 'Inter', sans-serif);
}

/* ✅ In Shadow DOM */
:host {
  font-family: var(--font-family-primary);
}
```

### Enforcement

- All CSS files must use `var(--font-family-primary)`
- Never hardcode font-family values
- Inter is the primary font - always use it
- Update both `.module.css` and `.shadow.css` files when changing fonts

## CSS !important Rule - STRICT REQUIREMENT

### ⚠️ CRITICAL: All CSS Properties Must Use !important

**EVERY CSS property declaration MUST include `!important` for style isolation and preventing conflicts.**

### Rationale

1. **Shadow DOM Isolation**: Content scripts use Shadow DOM which requires `!important` to override host page styles
2. **Style Conflicts**: Prevents external stylesheets from overriding component styles
3. **Consistency**: Ensures predictable styling across all environments
4. **Chrome Extension Context**: Extensions run in various page contexts where styles can conflict

### Rule: Every Property Gets !important

```css
/* ✅ Good - All properties have !important */
.button {
  background: var(--color-primary) !important;
  color: var(--color-white) !important;
  border: 2px solid var(--color-primary-light) !important;
  border-radius: 10px !important;
  padding: 12px 24px !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
}

.button:hover {
  background: var(--color-primary-dark) !important;
  transform: scale(1.05) !important;
}

/* ❌ BAD - Missing !important */
.button {
  background: var(--color-primary);
  color: var(--color-white);
  border: 2px solid var(--color-primary-light);
}
```

### Special Cases

#### CSS Variables

```css
/* ✅ Good - !important after the variable */
:host {
  --color-primary: #9527F5 !important;
  --color-white: #FFFFFF !important;
}

/* ✅ Good - !important on the property using the variable */
.button {
  background: var(--color-primary) !important;
  color: var(--color-white) !important;
}
```

#### Transitions with Multiple Properties

```css
/* ✅ Good - Each transition property gets !important */
.button {
  transition: transform 0.3s ease !important, 
              color 0.3s ease !important,
              background 0.3s ease !important;
}

/* ✅ Good - Shorthand with !important */
.button {
  transition: all 0.3s ease !important;
}
```

#### Shorthand Properties

```css
/* ✅ Good - Shorthand gets !important */
.container {
  margin: 10px 20px !important;
  padding: 16px 24px !important;
  border: 2px solid var(--color-primary) !important;
}
```

#### Pseudo-classes and Pseudo-elements

```css
/* ✅ Good - All pseudo-class properties have !important */
.button:hover {
  background: var(--color-primary-dark) !important;
  transform: scale(1.05) !important;
}

.button:active {
  transform: scale(0.95) !important;
}

.button::before {
  content: attr(data-tooltip) !important;
  position: absolute !important;
  background: var(--color-primary) !important;
  color: var(--color-white) !important;
}
```

#### Keyframes

```css
/* ✅ Good - Keyframe properties have !important */
@keyframes slideIn {
  from {
    transform: translateX(100%) !important;
    opacity: 0 !important;
  }
  to {
    transform: translateX(0) !important;
    opacity: 1 !important;
  }
}

/* ✅ Good - Animation property has !important */
.element {
  animation: slideIn 0.3s ease-out !important;
}
```

#### Media Queries

```css
/* ✅ Good - Media query properties have !important */
@media (max-width: 768px) {
  .container {
    width: 100% !important;
    padding: 12px !important;
  }
}
```

### Files That Must Follow This Rule

**ALL CSS files in the project:**

1. **Shadow DOM CSS Files**:
   - `src/content/styles/fab.shadow.css`
   - `src/content/styles/sidePanel.shadow.css`

2. **CSS Module Files**:
   - `src/content/components/FAB/FAB.module.css`
   - `src/content/components/SidePanel/SidePanel.module.css`
   - `src/content/components/SidePanel/Header.module.css`
   - `src/content/components/SidePanel/Footer.module.css`
   - `src/content/components/SidePanel/SummaryView.module.css`
   - `src/content/components/SidePanel/SettingsView.module.css`
   - `src/content/components/SidePanel/MyView.module.css`
   - `src/content/components/SidePanel/Dropdown.module.css`
   - `src/content/components/SidePanel/ResizeHandle.module.css`

3. **UI Component CSS Files**:
   - `src/components/ui/Toast/Toast.module.css`
   - `src/components/ui/LoginModal/LoginModal.module.css`
   - `src/components/ui/DropdownIcon/DropdownIcon.module.css`

4. **Global CSS Files**:
   - `src/index.css`

### Examples of What NOT to Do

```css
/* ❌ BAD - Missing !important on some properties */
.button {
  background: var(--color-primary) !important;
  color: var(--color-white); /* Missing !important */
  border: 2px solid var(--color-primary-light) !important;
}

/* ❌ BAD - No !important at all */
.container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ❌ BAD - Missing !important in keyframes */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### Examples of What TO Do

```css
/* ✅ Good - All properties have !important */
.button {
  background: var(--color-primary) !important;
  color: var(--color-white) !important;
  border: 2px solid var(--color-primary-light) !important;
  border-radius: 10px !important;
  padding: 12px 24px !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
}

.button:hover {
  background: var(--color-primary-dark) !important;
  transform: scale(1.05) !important;
}

/* ✅ Good - Keyframes with !important */
@keyframes fadeIn {
  from {
    opacity: 0 !important;
  }
  to {
    opacity: 1 !important;
  }
}

.element {
  animation: fadeIn 0.3s ease-out !important;
}
```

### Enforcement

- **Every CSS property** must have `!important`
- **No exceptions** - this applies to all CSS files
- **CSS variables** in `:host` or `:root` also need `!important`
- **Keyframes** properties need `!important`
- **Pseudo-classes** and **pseudo-elements** need `!important`
- **Transitions** and **animations** need `!important`
- **Media queries** need `!important`

### Checklist When Writing CSS

- [ ] Every property has `!important`
- [ ] CSS variables have `!important`
- [ ] Transitions have `!important`
- [ ] Pseudo-classes have `!important`
- [ ] Pseudo-elements have `!important`
- [ ] Keyframes have `!important`
- [ ] Media queries have `!important`
- [ ] Shorthand properties have `!important`

