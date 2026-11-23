import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ACCES_EQUIPE: "https://equipe-test.cloudflareaccess.com",
            ACCES_AUD: "aud-test",
            ACCES_COURRIEL: "proprio@exemple.ca",
            ACCES_SERVICE_ID: "service-test.access",
            GITHUB_CLE: "cle-test",
          },
        },
      }),
    ],
    test: { include: ["tests/**/*.test.ts"], setupFiles: ["./tests/preparer.ts"] },
  };
});
