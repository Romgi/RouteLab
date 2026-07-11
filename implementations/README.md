# Trusted language implementations

This directory contains RouteLab's authoritative repository-controlled Dijkstra references. The `/code` experience bundles curated excerpts that correspond to these files; visitor input never selects a filesystem path and cannot edit or execute source. The interactive visualizer uses the TypeScript algorithm engine under `lib/`, not these standalone programs.

All six versions use a min-priority queue, reject invalid graph references, validate finite nonnegative weights when the language's numeric model can represent invalid values, skip stale queue entries, track parents, stop once the goal is finalized, and reconstruct the path. Equal-priority entries use node identifiers as a stable secondary key when the standard queue permits it.

`line-map.json` is the synchronization contract. Line numbers are one-based and inclusive. A UI trace event first resolves through `eventToConcept`, then selects the matching range under the active language. Normalized-content SHA-256 values make source changes review-visible even when line counts stay equal. Keep the source and line map in the same commit whenever either changes.

## Local smoke checks

Run the checks for toolchains installed on your machine from a POSIX-compatible shell. Compiled artifacts stay in a temporary directory:

```bash
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/java"
npx tsc implementations/typescript/dijkstra.ts --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck
npx tsc implementations/typescript/dijkstra.ts implementations/typescript/dijkstra.smoke.ts --outDir "$tmp_dir/typescript" --target ES2022 --module commonjs --moduleResolution node --strict --skipLibCheck && node "$tmp_dir/typescript/dijkstra.smoke.js"
python implementations/python/dijkstra.py
javac -d "$tmp_dir/java" implementations/java/Dijkstra.java && java -cp "$tmp_dir/java" Dijkstra
g++ -std=c++20 -Wall -Wextra -Werror implementations/cpp/dijkstra.cpp -o "$tmp_dir/dijkstra-cpp" && "$tmp_dir/dijkstra-cpp"
go run implementations/go/dijkstra.go
rustc --edition 2021 -D warnings implementations/rust/dijkstra.rs -o "$tmp_dir/dijkstra-rust" && "$tmp_dir/dijkstra-rust"
```

The CI workflow provisions all six toolchains and runs these checks on every pull request.
