// chrono-node exposes its English-only build as "chrono-node/en" through the
// package "exports" map. Webpack follows that map; TypeScript's "node" module
// resolution doesn't, so point it at the same file's types.
declare module 'chrono-node/en' {
  export * from 'chrono-node/dist/esm/locales/en/index';
}
