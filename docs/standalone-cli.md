# Standalone CLI Overview

The standalone bootstrap CLI lives in `standalone-cli/` and remains additive to the existing gateway, daemon, CLI, and desktop surfaces. It does not replace those products.

Use [`standalone-cli/README.md`](../standalone-cli/README.md) as the canonical operator guide and authoritative runbook for:

- first run
- repeat run behavior
- workspace artifacts under `~/.ccgw/standalone-cli/`
- missing-credentials recovery
- missing-`claude` recovery
- package-local validation with `npm --prefix standalone-cli test`

This repo-level doc is intentionally a short overview so the checked-in operator procedure stays in one place.
