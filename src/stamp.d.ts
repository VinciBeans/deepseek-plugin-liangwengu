/**
 * Build-time constants injected by `scripts/build.mjs` through esbuild's
 * `define`. Declared here so both halves typecheck against the real name; the
 * bundler replaces every reference with the literal, so nothing is read at
 * runtime.
 */

/**
 * Source-identity stamp of this build: a short hash over every file under
 * `src/` (paths + normalised contents).
 *
 * Deterministic in the sources, so rebuilding the same sources yields the same
 * stamp and the CI guard (`git diff --exit-code -- lib`) stays meaningful. The
 * browser half compares its own stamp against the one the host reports, which
 * is how a stale host process — new UI, old plugin — becomes visible instead of
 * looking like a missing endpoint.
 */
declare const __LWGU_STAMP__: string
