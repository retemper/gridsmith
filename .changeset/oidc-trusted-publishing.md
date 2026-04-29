---
'@gridsmith/core': patch
'@gridsmith/react': patch
---

Switch the release pipeline to npm Trusted Publishing (OIDC) and enable provenance attestations.

Each tarball now ships with a Sigstore-signed npm provenance attestation linking the
release back to the GitHub Actions workflow that built it
(`retemper/gridsmith` → `.github/workflows/publish.yml`). Consumers can verify the
chain with `npm audit signatures`. No long-lived npm token is required for releases —
the publish workflow authenticates to the registry via short-lived GitHub OIDC
identities scoped to this repo and workflow path.
