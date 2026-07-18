import { writeFile } from "node:fs/promises";

const args = process.argv.slice(2);

function valueFor(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const baseUrlValue = valueFor("--base-url");
const routesValue = valueFor("--routes") ?? "/,/agro,/seguridad";
const outputPath = valueFor("--output");
const timeoutMs = Number(valueFor("--timeout-ms") ?? "15000");

if (!baseUrlValue) {
  throw new Error("Uso: node ops/post-deploy-smoke.mjs --base-url https://host --routes /,/agro,/seguridad");
}
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
  throw new Error("--timeout-ms debe ser un entero entre 1000 y 60000.");
}

const baseUrl = new URL(baseUrlValue);
if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("El smoke remoto exige HTTPS; HTTP solo se acepta para localhost.");
}
if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  throw new Error("--base-url no puede contener credenciales, query string ni fragmento.");
}

const routes = routesValue.split(",").map((route) => route.trim()).filter(Boolean);
if (routes.length === 0 || routes.some((route) => !route.startsWith("/") || route.startsWith("//"))) {
  throw new Error("--routes debe contener rutas publicas absolutas separadas por coma.");
}

const results = [];
let failed = false;

for (const route of routes) {
  const url = new URL(route, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new Error(`Ruta fuera del origen permitido: ${route}`);
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": "mundoconnect-post-deploy-smoke/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const isHtml = contentType.toLowerCase().includes("text/html");
    const hasAppShell = /<html|<!doctype html/i.test(body);
    const passed = response.status === 200 && isHtml && hasAppShell;
    failed ||= !passed;
    results.push({ route, url: url.href, status: response.status, contentType, durationMs: Date.now() - startedAt, passed });
  } catch (error) {
    failed = true;
    results.push({ route, url: url.href, durationMs: Date.now() - startedAt, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const report = {
  schemaVersion: 1,
  checkedAtUtc: new Date().toISOString(),
  baseUrl: baseUrl.origin,
  authenticated: false,
  passed: !failed,
  results,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
process.stdout.write(serialized);
if (outputPath) await writeFile(outputPath, serialized, "utf8");
if (failed) process.exitCode = 1;

