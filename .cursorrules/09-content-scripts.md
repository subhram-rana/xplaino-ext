# 09 - Content Scripts Architecture

## Overview

Content scripts in Chrome extensions inject UI into web pages using Shadow DOM for style isolation. This document outlines the proper architecture to maintain modularity and prevent code duplication.

## Core Principle

**The content script entry point (`src/content/index.ts`) must be a minimal orchestration layer.**

It should ONLY handle:
- Domain permission checking
- Shadow DOM host creation
- React component mounting
- Chrome storage listeners

All component logic and styling MUST live in their respective component directories.

## Directory Structure

```
src/content/
├── index.ts              # Entry point (~150-200 lines max)
├── utils/
│   └── shadowDom.ts      # Shadow DOM utilities
├── styles/
│   ├── fab.shadow.css    # Plain CSS for FAB (Shadow DOM)
│   └── sidePanel.shadow.css  # Plain CSS for SidePanel (Shadow DOM)
└── components/           # All component logic here
    ├── FAB/
    │   ├── FAB.tsx
    │   ├── FAB.module.css
    │   ├── ActionButton.tsx
    │   └── index.ts
    └── SidePanel/
        ├── SidePanel.tsx
        ├── SidePanel.module.css
        └── index.ts
```

## Shadow DOM Styling

### Why Separate Shadow CSS Files?

CSS Modules generate hashed class names that don't work in Shadow DOM contexts. We use:
- `.module.css` files for regular React rendering
- `.shadow.css` files for Shadow DOM injection (plain class names)

### Importing Styles for Shadow DOM

Use Vite's `?inline` suffix to import CSS as strings:

```typescript
import fabStyles from './styles/fab.shadow.css?inline';
import sidePanelStyles from './styles/sidePanel.shadow.css?inline';
```

### Component Dual-Context Support

Components must support both Shadow DOM and regular contexts:

```typescript
interface FABProps {
  useShadowDom?: boolean;
  // ... other props
}

const FAB: React.FC<FABProps> = ({ useShadowDom = false }) => {
  const getClassName = (shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  };
  
  return (
    <div className={getClassName('fabParent', styles.fabParent)}>
      {/* ... */}
    </div>
  );
};
```

## Anti-Patterns (NEVER Do This)

### ❌ Inline CSS in Content Script

```typescript
// BAD - Don't do this!
const FAB_STYLES = `
  .fabButton {
    background: #9527F5;
    border-radius: 50%;
  }
`;
```

### ❌ Inline Components in Content Script

```typescript
// BAD - Don't do this!
const FABComponent: React.FC = () => {
  // 100+ lines of component logic in content script
};
```

### ❌ Duplicating Existing Components

If a component exists in `src/content/components/`, use it. Don't recreate it inline.

## Best Practices (ALWAYS Do This)

### ✅ Import Components

```typescript
import { FAB } from './components/FAB';
import { SidePanel } from './components/SidePanel';
```

### ✅ Use Shadow DOM Utilities

```typescript
import {
  createShadowHost,
  injectStyles,
  removeShadowHost,
} from './utils/shadowDom';
```

### ✅ Keep Entry Point Minimal

```typescript
// Good - content/index.ts should look like this
function injectFAB(): void {
  const { host, shadow, mountPoint } = createShadowHost({ id: 'fab-host' });
  injectStyles(shadow, fabStyles);
  document.body.appendChild(host);
  
  fabRoot = ReactDOM.createRoot(mountPoint);
  fabRoot.render(React.createElement(FAB, { useShadowDom: true }));
}
```

### ✅ Sync Shadow CSS with Module CSS

When updating styles, update BOTH files:
- `FAB.module.css` - for regular React context
- `fab.shadow.css` - for Shadow DOM context

## TypeScript Declarations

Ensure `src/vite-env.d.ts` includes:

```typescript
declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*.shadow.css?inline' {
  const css: string;
  export default css;
}
```

## Chrome Extension Asset URLs

In Shadow DOM context, use `chrome.runtime.getURL()` for extension assets:

```typescript
const iconUrl = chrome.runtime.getURL('src/assets/icons/icon.ico');
```

Don't forget to add assets to `web_accessible_resources` in `manifest.json`.

