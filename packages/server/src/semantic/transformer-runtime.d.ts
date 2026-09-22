// `@huggingface/transformers` is an optional peer dependency: not installed in
// this repo, so tsc cannot resolve it. This shorthand ambient declaration lets
// the literal dynamic import in transformer-embedder.ts typecheck; the loader
// narrows the module to the TransformerRuntime slice it actually uses.
declare module '@huggingface/transformers';
