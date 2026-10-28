import { defineConfig } from 'tsup';
// node:sqlite is a prefix-only Node builtin; stripping node: makes it a missing npm dependency.
export default defineConfig({ removeNodeProtocol: false });
