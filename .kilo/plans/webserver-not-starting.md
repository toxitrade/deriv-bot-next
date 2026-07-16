# Webserver exits immediately after Next.js Ready

## Symptom
`npm run dev` prints:

```text
▲ Next.js 16.2.7 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://10.42.0.131:3000
✓ Ready in 786ms
```

Then the process exits and returns to the shell prompt. No terminal error was shown.

## Likely causes
1. **Next.js 16.2.x/Turbopack runtime issue**: There are known Next.js 16 dev-server cases where the process exits cleanly after printing Ready, especially with Turbopack and newer Node versions.
2. **Node 24 compatibility**: The local Node version is `v24.16.0`. Next.js 16 requires `>=20.9.0`, but some 16.2.x/Turbopack bugs are Node-version sensitive.
3. **Dependency update side effect**: The user recently updated dependencies, so `next`, React, SmartCharts, or transitive packages may have moved to a combination that triggers the dev-server exit.

## Diagnostic plan
1. Confirm exit code:
   - Run `npm run dev`
   - When it returns to the prompt, run `echo $?`
   - Expected useful values:
     - `0` = clean/silent Next.js dev-server exit
     - non-zero = crash/error
2. Test non-Turbopack dev server:
   - Run `npm run dev -- --webpack`
   - If it stays running, the issue is Turbopack-specific.
3. Test a stable Next.js minor patch:
   - If `--webpack` works, try pinning/upgrading to a known stable Next.js patch such as `16.2.7` or newer if available.
   - If already on `16.2.7`, test `16.2.5` as a temporary workaround if `16.2.6/16.2.7` regressions are suspected.
4. Test Node LTS compatibility:
   - Run with Node 22 LTS or Node 20 LTS if available.
   - If that fixes it, set the project engine to a supported LTS range and document it.
5. Clean install if dependency graph is inconsistent:
   - Remove `node_modules`, `.next`, and `tsconfig.tsbuildinfo`.
   - Reinstall with `npm ci`.
   - Re-run `npm run dev -- --webpack` and then normal `npm run dev`.
6. If the server stays running with `--webpack`, update the dev script to use webpack temporarily or keep it as a documented workaround until Turbopack is stable.

## Fix strategy
- Prefer the smallest safe fix:
  - If Turbopack-specific: change dev script to `next dev --webpack` or remove the explicit Turbopack config.
  - If Node-version-specific: add/adjust `engines` to Node 20/22 LTS and tell the user to use that Node version.
  - If dependency update-specific: pin the problematic package back to the last working version.
- After any change, validate with:
  - `npm run dev -- --webpack`
  - `npm run build`
  - `npx tsc --noEmit`
