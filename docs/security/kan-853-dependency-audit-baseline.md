# KAN-853/S1 — Security baseline and dependency exposure matrix

Source: operator's clean disposable lab (2026-10-23); commit `9d38f3810416238a856a1fa08892add28bed3c16`; `pnpm-lock.yaml` SHA-256 `ecd261e27e6d9e6c29a7e6d152226aa28af959c76dd5ba1a3680f83a00b09d88`. `pnpm install --frozen-lockfile` PASS with pnpm 12.4.1 and a separate store. Node 24.19.0 reported separately. `pnpm audit --json`: EXIT 1, 64 advisories (3 critical, 25 high, 30 moderate, 6 low), **17 distinct affected package names**; advisories are not equivalent to proven reachable vulnerabilities. Operator's `audit.json` is evidence kept outside Git; do not commit generated lab files or secrets.

## Direct dependencies
| Package/version | Audit evidence | Route | Proposed follow-up |
|---|---|---|---|
| `next@16.3.8` | 3 (2 critical, 1 high); GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r, audit patched >=16.4.1 | direct; also next-intl/next-pwa | S2 causal HTTP comparison on 16.4.3 without private 16.3.8 patch; S3 conditional upgrade |
| `zod@4.4.3` | 1 high GHSA-mrhx-c7xc-m3w5, audit patched >=4.6.6 | direct, eslint-config-next; *separate* zod 3.25.76 via shadcn | S4 inspect untrusted collection boundaries, evaluate 4.6.7 without presuming all transitive branches remediated |
| `shadcn@4.19.0` | root of multiple transitives, although audit flags some `dev:false` | direct dependency in `dependencies` | Investigate whether CLI is used during build/runtime and if it belongs in devDependencies; no reclassification without behavior proof |
| `@ducanh2912/next-pwa@10.2.9` | root of Workbox/Webpack transitives | direct | Assess PWA build vs server exposure and compatibility with Next 16.4.x |

## Transitive grouping (from audit finding paths)
| Name/version(s) | Advisories | Representative root paths | Patched baseline in audit |
|---|---:|---|---|
| undici 7.29.0 | 13 | shadcn | >=7.30.1 covers listed ranges |
| fast-uri 3.1.5 | 10 | shadcn, next-pwa | >=3.1.9 covers listed ranges |
| brace-expansion 1.1.18 / 2.1.4 / 5.0.9 | 9 | eslint, eslint-config-next, next-pwa, shadcn | >=1.1.21, >=2.1.7, >=5.0.12 by major line |
| @modelcontextprotocol/sdk 1.30.0 | 5 | shadcn | >=1.32.0 |
| hono 4.13.3 | 5 | shadcn | >=4.13.11 |
| ip-address 10.5.0 | 5 | shadcn | >=10.7.4 |
| serialize-javascript 6.0.2 | 3 | next-pwa > workbox-build | >=7.1.3 (major-version compatibility unproven) |
| qs 6.15.3 | 2 | shadcn > express | >=6.16.0 |
| sharp 0.35.3 | 2 | next-pwa webpack/minimizer-webpack-plugin, optional | >=0.35.5; platform/runtime packaging risk |
| esbuild 0.18.20 | 1 | drizzle-kit dev | >=0.25.0 (compatibility unproven) |
| js-yaml 4.3.1 | 1 | shadcn > cosmiconfig | >=4.3.2 |
| source-map-js 1.2.1 | 1 | next, next-intl, next-pwa, tailwind postcss, shadcn | >=1.2.2 |
| proxy-addr 2.0.7 | 1 critical | shadcn > MCP SDK > express | >=2.0.8 |
| postcss-selector-parser 7.1.5 | 1 | shadcn | >=7.1.6 |
| body-parser 2.3.0 | 1 | shadcn > MCP SDK > express | >=2.4.0 |

## Scope and decisions
- Next, Zod, and lint tooling versions are effective resolutions from the fresh lab, not just manifest version ranges.
- Audit output includes developer/build/transitive packages and optional installations; `dev:false` is NOT proof of exposed server runtime. Neither the direct classification of `shadcn` nor a lockfile path establishes execution reachability. Classify with source inspection in S3/S4 or a separately approved security follow-up.
- No evidence here warrants a bulk update of unrelated packages during S1. Triage the transitive chain and propose distinct scope for any remediation outside KAN-852.
- Reversible change strategy for S3/S4: retain SHA and lockfile hash above, one isolated security branch from dev, atomic version/lockfile edits after approved RED where applicable, frozen install, causal HTTP and auth regression, restore by reverting isolated commits (no force reset), gate and post-merge only in S5.
- The `audit.json` findings are a point-in-time registry snapshot; patched baselines are from its advisory records and are not evidence of successful application upgrade.
- Follow-up on a key ambiguity: the Zod advisory lists both 4.4.3 and 3.25.76 under `<4.6.6`; investigate whether the v3 branch is affected and which fix strategy applies rather than assuming that range is actionable across majors.
- S1 acceptance: complete characterization and documentary disposition, NOT vulnerability remediation. Only close once evidence and outstanding risks are explicitly reconciled into Jira. S2 and S4 remain blocked until then.
