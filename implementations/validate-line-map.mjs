import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const repositoryRoot = new URL("../", import.meta.url);
const metadata = JSON.parse(
  await readFile(new URL("line-map.json", import.meta.url), "utf8"),
);

assert.equal(metadata.schemaVersion, 1);
assert.equal(metadata.lineNumberBase, 1);
assert.equal(metadata.endInclusive, true);

for (const [language, source] of Object.entries(metadata.sources)) {
  const text = (
    await readFile(new URL(source.path, repositoryRoot), "utf8")
  ).replace(/\r\n/g, "\n");
  const contentSha256 = createHash("sha256").update(text).digest("hex");
  assert.equal(
    contentSha256,
    source.contentSha256,
    `${language}: source content changed; review and update line-map.json`,
  );
  const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
  assert.equal(
    lines.length,
    source.lineCount,
    `${language}: source line count changed; update line-map.json`,
  );

  for (const [concept, range] of Object.entries(source.sections)) {
    assert.ok(
      Number.isInteger(range.start),
      `${language}/${concept}: invalid start`,
    );
    assert.ok(
      Number.isInteger(range.end),
      `${language}/${concept}: invalid end`,
    );
    assert.ok(
      range.start >= 1,
      `${language}/${concept}: start is before line 1`,
    );
    assert.ok(
      range.end >= range.start,
      `${language}/${concept}: reversed range`,
    );
    assert.ok(
      range.end <= lines.length,
      `${language}/${concept}: range exceeds source`,
    );
  }
}

for (const concept of Object.values(metadata.eventToConcept)) {
  for (const [language, source] of Object.entries(metadata.sources)) {
    assert.ok(
      Object.hasOwn(source.sections, concept),
      `${language}: missing mapped concept ${concept}`,
    );
  }
}

console.log("language line map: ok");
