import { createReadStream, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT = fileURLToPath(new URL("./out", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
const FRAMES = ["01-hero", "02-import", "03-session", "04-source", "05-habitude"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const rel = url.pathname === "/" ? "/docs/app-store/frames.html" : url.pathname;
      const file = join(ROOT, rel.replace(/^\/+/, ""));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }
      const stream = createReadStream(file);
      stream.on("error", () => res.writeHead(404).end());
      stream.on("open", () => {
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
        stream.pipe(res);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, origin } = await startServer();
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1290, height: 2796, deviceScaleFactor: 1 });
  await page.goto(`${origin}/docs/app-store/frames.html`, {
    waitUntil: "networkidle0",
  });
  await page.evaluateHandle("document.fonts.ready");

  for (const name of FRAMES) {
    const handle = await page.$(`[data-frame="${name}"]`);
    if (!handle) throw new Error(`Frame ${name} introuvable`);
    const dest = join(OUT, `${name}-1290x2796.png`);
    await handle.screenshot({ path: dest, type: "png" });
    console.log(dest);
  }
} finally {
  await browser.close();
  server.close();
}
