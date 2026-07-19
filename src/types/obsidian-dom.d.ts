export {};

declare global {
  interface Window {
    /** Obsidian DOM helper declared globally by the public API typings. */
    createFragment(callback?: (fragment: DocumentFragment) => void): DocumentFragment;
  }
}
