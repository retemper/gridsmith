---
'@gridsmith/core': patch
'@gridsmith/react': patch
---

Re-attempt the 1.0.x publish via npm Trusted Publishing.

The 1.0.1 publish workflow failed at the "Install npm" step: `npm install -g npm@latest`
crashed mid-upgrade with `Cannot find module 'promise-retry'`, a known
self-replacement bug in npm 10.x. The publish job now installs the newer npm
into a separate prefix (`$HOME/.npm-trusted`) and prepends it to `PATH`, which
avoids touching the running npm's module tree. No package behavior changes; this
release is the first to actually ship through OIDC + provenance attestation.
