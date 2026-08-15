import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const hostingSource = resolve(root, ".openai", "hosting.json");
const hostingTarget = resolve(root, "dist", ".openai", "hosting.json");
const serverTarget = resolve(root, "dist", "server", "index.js");
const indexHtml = readFileSync(resolve(root, "dist", "client", "index.html"), "utf8");

mkdirSync(dirname(hostingTarget), { recursive: true });
mkdirSync(dirname(serverTarget), { recursive: true });
copyFileSync(hostingSource, hostingTarget);

writeFileSync(
  serverTarget,
  `const fallbackHtml = ${JSON.stringify(indexHtml)};

export default {
  async fetch(request, env) {
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(fallbackHtml, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
`,
);
