---
"seekstone": patch
---

`seekstone init --help` (and `-h`) now prints the init subcommand's usage — its `--vault`, `--client`, and `--write` flags — instead of ignoring the flag and running the init flow (vault auto-detection). Help flags after `init` were previously swallowed by init's own argument parsing.
