---
'@gridsmith/core': patch
'@gridsmith/react': patch
---

Re-attempt the 1.0.x publish via npm Trusted Publishing.

The 1.0.3 publish workflow surfaced that `pnpm changeset:publish` (and the
underlying `pnpm publish`) does not implement npm's OIDC trusted-publishing
handshake, so without an `_authToken` in `.npmrc` it fails fast with
`ENEEDAUTH`. npm CLI 11.5+ does implement the handshake natively when
invoked directly. Replace the publish step with a tarball-based loop:
`pnpm pack` per package (so workspace `workspace:*` deps are rewritten to
real versions), then `npm publish <tarball> --access public --provenance`,
which triggers the OIDC token exchange against the trusted publishers
already configured for `@gridsmith/core` and `@gridsmith/react`.
