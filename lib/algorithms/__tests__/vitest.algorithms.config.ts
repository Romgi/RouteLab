import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/algorithms/__tests__/algorithms.test.ts"],
  },
});
