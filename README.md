# template

Start every new irmahs-labs repo from here, so each one has the same rules, hooks, lint and CI from its first commit.

## What every repo gets

|  |  |
| --- | --- |
| `CLAUDE.md` | The shared rules for Claude: branch names, pull requests Irma merges, the checks before pushing |
| `.claude/` | Hooks: dependencies installed in cloud sessions, and Ultracite plus a typecheck on every file Claude edits |
| `oxlint.config.ts`, `oxfmt.config.ts` | Ultracite (oxlint + oxfmt), blocking in CI from day one |
| `.github/workflows/ci.yml` | Lint and format, Type-check, Tests, Build, Docker build from [irmahs-labs/workflows](https://github.com/irmahs-labs/workflows), then the `checks` job the branch rules require |
| `.github/workflows/codeql.yml` | CodeQL code scanning from irmahs-labs/workflows: a security analysis of the code and the workflows, with findings in the Security tab |
| `.github/dependabot.yml` | Monthly pull requests that update npm packages and GitHub Actions, minor and patch updates grouped |
| `.github/workflows/deploy.yml` | On merge to `main`: SSH to the server, pull, `docker compose up --build --wait` |
| `ruleset.json` | The branch rules every repo has on `main` |
| `src/`, `Dockerfile`, `compose.yaml` | A placeholder Node server so CI has something to check. Replace it with the app |

## Making a new repo

1. **New repository → Repository template: `irmahs-labs/template`.** Make it public unless it must be private: on GitHub's free plan a private repo gets no branch rules, no organisation secrets and no code scanning (delete `.github/workflows/codeql.yml` in a private one).
2. **Branch rules:** Settings → Rules → Rulesets → New ruleset → **Import a ruleset** → this repo's `ruleset.json` → Create.
3. **Dependabot security fixes:** Settings → Code security → enable **Dependabot alerts** and **Dependabot security updates**, unless the organisation already turns them on for new repositories.
4. **Claude:** if the Claude GitHub app has access to selected repositories only, add the new one (organisation settings → Installed GitHub Apps → Claude → Configure).
5. **The app:** ask Claude to build it in place of `src/`, keeping the scripts `check`, `typecheck`, `test`, `build` and `start`, adding the Ultracite presets it needs in `oxlint.config.ts` (`react`, `next`), and filling in CLAUDE.md's last sections.
6. **Deploying** (skip until there is something to deploy):
   - In `compose.yaml`, rename the `app` alias to the repo's name.
   - In irmahs-labs/proxy, add the Caddyfile block for `<name>.irmahs.dev` (its README shows how), and in Cloudflare the proxied `A` and `AAAA` records.
   - On the server, as admin: `sudo mkdir /srv/<name> && sudo chown deploy:deploy /srv/<name>`.
   - Secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_HOST` come from the organisation for public repos; a private repo needs them as its own secrets.

## Keeping every repo in step

Change shared things here first (CLAUDE.md's shared sections, `.claude/`, the lint config, `ruleset.json`), or in irmahs-labs/workflows for CI. Then ask Claude to _sync the repos with irmahs-labs/template_: it opens one pull request per repo. A change to the shared CI workflow reaches every repo on its next run, with no pull requests.
