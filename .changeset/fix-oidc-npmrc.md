---
'@gridsmith/core': patch
'@gridsmith/react': patch
---

Re-attempt the 1.0.x publish via npm Trusted Publishing.

The 1.0.2 publish workflow signed the Sigstore provenance attestation
successfully but the registry PUT was rejected with `E404`. Root cause: the
`actions/setup-node` step had `registry-url: 'https://registry.npmjs.org'`,
which writes an `.npmrc` containing `_authToken=${NODE_AUTH_TOKEN}`. With no
token in scope the line still resolves to "auth configured but empty", and
npm CLI 11 falls through to that empty credential instead of switching to the
OIDC trusted-publishing flow. Dropping `registry-url` from `setup-node`
removes the stub `.npmrc`, so npm CLI sees no configured auth and exchanges
the workflow's OIDC identity for a short-lived publish token as intended.
