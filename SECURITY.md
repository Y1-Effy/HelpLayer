# Security Policy

**English** | [日本語](./SECURITY.ja.md)

HelpLayer is a small, framework-agnostic, fully client-side library, maintained on a
best-effort basis. This document describes how to report a vulnerability and what you can
expect in return. For the library's technical security posture (XSS, CSP, Trusted Types),
see the [Security section of the README](./README.md#security).

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (<https://github.com/Y1-Effy/HelpLayer/security/advisories/new>).
2. Describe the issue, affected version, and a reproduction if possible.

You can expect an acknowledgement within a few days. As this is a solo, best-effort project
there is no guaranteed response SLA, but security reports are prioritized over other work.

## Supported versions

Only the **latest published release** receives security fixes. Earlier versions are not
backported — please upgrade to the current version.

## Security release policy

- A confirmed vulnerability is fixed and shipped as a new patch release.
- A [GitHub Security Advisory (GHSA)](https://github.com/Y1-Effy/HelpLayer/security/advisories)
  is published, with a CVE requested when warranted.
- The fix is called out in the release notes / changelog so consumers can act.

## Dependency policy

- **HelpLayer has no runtime dependencies** — the shipped `dist/` bundles pull in nothing at run time.
  [`@floating-ui/dom`](https://floating-ui.com/) is a **devDependency** only (it backs an alternative,
  non-default positioning backend and the typecheck); the default backend is dependency-free.
- [Dependabot](./.github/dependabot.yml) watches npm dependencies and GitHub Actions weekly,
  so security and maintenance updates are surfaced as pull requests.
- When loading HelpLayer from a CDN, pin an exact version and add Subresource Integrity
  (SRI) — see the README.

## Threat model (summary)

HelpLayer runs entirely in the browser and is designed to **minimize** any additional attack surface it
introduces to the host app. (It does add DOM, a `<style>`, event listeners, focus control, and `inert`,
and `render` can insert arbitrary DOM — so the surface isn't literally zero; the goal is to keep it as
small as possible.) The full details live in the [README Security section](./README.md#security);
in short:

- **No network, no storage.** It never calls `fetch`, and never touches
  `localStorage` / `cookie`.
- **Text is rendered with `textContent` only.** `innerHTML` / `eval` / `new Function` are
  never used, so it is compatible with strict CSP and Trusted Types as-is.
- **The `render` option is the only path** through which caller-provided data becomes
  HTML/DOM nodes, and its return value is **not** sanitized. Callers must neutralize any
  untrusted input they pass through `render`.
- **The injected `<style>`** is the one CSP-relevant artifact; under a strict `style-src`,
  pass a per-request `nonce` via the `nonce` option.
- **The transparent blocking layer** absorbs interaction without attaching to or modifying
  the host app's own event listeners, and everything it adds is fully removed on teardown.
