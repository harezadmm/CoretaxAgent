# Deployment notes

## Vercel deploys from Git, not from the CLI

The project is connected to `harezadmm/CoretaxAgent`. Pushing to `main` builds
production (`coretax-ai-agent.vercel.app`); pushing any other branch builds a
preview at `coretax-ai-agent-git-<branch>-…`.

Prefer that path. `vercel deploy` uploads the working tree file by file and hits
the free tier's cap of 5,000 uploads per 24 hours — `knowledge/regulations`
alone is 6,266 files, so a single CLI deploy exhausts the quota. Git builds clone
on Vercel's side and upload nothing, so they are unaffected.

If a CLI deploy is genuinely needed, use `vercel deploy --archive=tgz`.

## `routes`, not `rewrites`

A `rewrite` is consulted only *after* Vercel has tried to serve the request from
the repository root as a static file. With no output directory configured, the
root is the static output, so `/app/agent.py`, `/app/config.py` and
`/requirements.txt` were all publicly downloadable from production — verified
returning 200 with content on 24 August 2026.

Legacy `routes` are matched before the filesystem phase. The single catch-all in
`vercel.json` therefore sends every path to the function, and no source file is
reachable. Confirm after any routing change by checking that the catch-all still
precedes the `handle: filesystem` entry:

```bash
vercel build
node -e "console.log(require('./.vercel/output/config.json').routes)"
```

The dashboard is unaffected either way: its CSS, JS and sprites are served by
FastAPI's own `/static` mount, not by Vercel's static layer.

## `vercel.json` is schema-validated on the platform

The platform rejects unknown top-level properties even though `vercel build`
accepts them locally. In particular the `"//"` key commonly used as a JSON
comment will fail the build with no useful local signal — two deployments were
lost to it. Keep explanations in this file instead.

## What is excluded

`.vercelignore` controls what is uploaded; `functions.excludeFiles` in
`vercel.json` controls what goes into the function bundle. They are separate, and
a pattern in one does not apply to the other — `.pytest_cache` was listed in the
first and still shipped in the second until both were updated.

`.git` is excluded because it is 332 MB here and `--archive=tgz` does not drop it
on its own, which inflated the archive to 448 MB against the 51 MB the
file-by-file path computed.
