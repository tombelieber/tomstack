# Keep reusable skills in one canonical monorepo

## Context

Reusable skills had grown as one skill per repository or as product-bundled
copies. That made discovery, invocation metadata, documentation, and release
policy drift independently.

## Decision

Tomstack is the canonical source for reusable skill contracts. Skills are
grouped by lifecycle and domain. Standalone tools may retain compatibility
snapshots required by their existing plugin or CLI installers, but new skill
development and promotion starts here.

Heavy products with their own executable, runtime, MCP server, or release
lifecycle remain standalone products and are linked from the marketplace.
