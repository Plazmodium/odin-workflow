# Publishing `@plazmodium/odin`

This guide is for maintainers publishing the Odin runtime from `odin-workflow/runtime` to the public npm registry.

## Current publish target

- npm account: `plazmodium`
- npm scope: `@plazmodium`
- package name: `@plazmodium/odin`
- package root: `runtime/`

## Prerequisites

- `pnpm whoami` returns `plazmodium`
- 2FA is enabled on the npm account
- `runtime/package.json` has the intended version
- runtime tests pass locally
- `runtime/README.md` reflects the current user-facing install path

## Version and tag policy

- While Odin is still labeled beta, publish prereleases with the `beta` dist-tag.
- Recommended command for the current line:

```bash
pnpm publish --access public --tag beta
```

- Only publish to `latest` when you intentionally want `pnpm dlx @plazmodium/odin ...` to resolve to a non-beta release.

## Prepublish checklist

From `runtime/`:

```bash
pnpm install
pnpm run type-check
pnpm test
pnpm pack --dry-run
```

Confirm the package includes:

- `dist/cli.js`
- `dist/server.js`
- `dist/init.js`
- `builtin/ODIN.md`
- `builtin/skills/`
- `builtin/agent-definitions/`
- `migrations/`
- `README.md`

Confirm the package does not include:

- local `.env` files
- editor files
- unrelated repo content
- dev-only documentation

## First publish or next beta publish

From `runtime/`:

```bash
pnpm publish --access public --tag beta
```

Then verify:

```bash
pnpm dlx @plazmodium/odin --help
pnpm dlx @plazmodium/odin init --help
```

If the package should also be tested as an MCP server entrypoint, run:

```bash
pnpm dlx @plazmodium/odin mcp
```

## Postpublish checklist

- verify the npm page renders the expected README
- update root `README.md` and `runtime/README.md` if install commands, tags, or package naming changed
- keep repo-checkout flow as the maintainer fallback path
- record the published version in release notes or changelog if used

## Troubleshooting

### `E404` or package not found after publish

- wait a short time for npm propagation
- retry `pnpm view @plazmodium/odin version`

### `402` / access / scope errors

- confirm you are logged into the `plazmodium` account
- confirm the package name is still `@plazmodium/odin`
- confirm you are publishing with `--access public`

### 2FA or auth failures

- rerun `pnpm whoami`
- confirm the current shell is authenticated as `plazmodium`
- retry with a fresh login if needed

## Future improvements

- automate publish with GitHub Actions trusted publishing
- add a changelog or release-notes step tied to npm version bumps
- add a smoke-test script that validates `odin`, `odin init`, and `odin mcp` from the packed tarball before publish
