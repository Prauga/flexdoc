# Contributing to FlexDoc

## Stacked pull requests and generated renderer assets

FlexDoc uses stacked pull requests and checked-in standalone renderer assets. That combination has one non-negotiable invariant:

> **Never use CI, bots, or temporary helper commits to mutate an actual stacked PR branch.**

A PR branch may move only because of an intentional product, test, documentation, or final generated-asset commit. Validation workflows must not push back to `github.head_ref`, and renderer-generation helpers must never commit directly onto a feature/fix PR branch.

### Renderer capture procedure

For every client-changing PR that affects the standalone renderer:

1. Finish the source change first and record the exact 40-character source commit SHA.
2. Treat every already-finalized parent SHA as frozen before starting or rebuilding a child PR.
3. Run the dedicated **Renderer Asset Capture** workflow with:
   - `source_sha`: the exact source commit SHA;
   - `capture_branch`: a throwaway branch under `capture/renderer/*`.
4. The capture workflow may force-update only that throwaway `capture/renderer/*` branch.
5. Only these canonical generated files may be committed by the capture workflow:
   - `adapters/go/assets/flexdoc.standalone.{js,css}`
   - `adapters/python/src/prauga_flexdoc/_assets/flexdoc.standalone.{js,css}`
   - `adapters/rust/assets/flexdoc.standalone.{js,css}`
   - `adapters/php/assets/flexdoc.standalone.{js,css}`
   - `adapters/ruby/assets/flexdoc.standalone.{js,css}`
   - `adapters/rust-actix/assets/flexdoc.standalone.{js,css}`
   - `adapters/elixir/assets/flexdoc.standalone.{js,css}`
6. Never run `git add adapters`, never stage a runtime's whole directory, and never include dependency/vendor/build directories in a renderer refresh.
7. Build the final PR commit from the intended source tree plus the captured canonical asset blobs. The throwaway capture branch is not part of PR history.
8. Run the full validation matrix on the exact final PR head. A green ancestor is not evidence for a rewritten head.
9. If a frozen parent genuinely must change, restack affected descendants once in topological order, then freeze the graph again before continuing new downstream work.

### Required final checks

Before considering a client-changing stacked PR ready:

- its base SHA is the intended frozen parent;
- its head contains no temporary workflow/capture commits;
- its changed-file list contains no vendor/build/dependency directories;
- all seven JS copies and all seven CSS copies are byte-identical to the exact canonical standalone build;
- the final head has fresh CI/check runs;
- renderer/performance budgets have not been weakened merely to make the change fit.

The capture workflow is deliberately the only workflow allowed to combine renderer synchronization with a Git push, and it refuses branch names outside `capture/renderer/*`.
