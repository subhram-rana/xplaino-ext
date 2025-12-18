/// <reference types="vite/client" />

/**
 * Type declarations for CSS modules
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

/**
 * Type declarations for icon files
 */
declare module '*.ico' {
  const src: string;
  export default src;
}

/**
 * Type declarations for CSS files imported as inline strings
 * Used for Shadow DOM style injection
 */
declare module '*.css?inline' {
  const css: string;
  export default css;
}

/**
 * Type declarations for Shadow CSS files
 */
declare module '*.shadow.css?inline' {
  const css: string;
  export default css;
}

