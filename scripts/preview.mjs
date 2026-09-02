import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 3000);

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

async function findMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(full)));
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      files.push(relative(ROOT, full).split(sep).join("/"));
    }
  }
  return files.sort();
}

function page(title, body, files, current) {
  const nav = files
    .map((f) => {
      const active = f === current ? ' class="active"' : "";
      return `<li${active}><a href="/?file=${encodeURIComponent(f)}">${f}</a></li>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; background: #f6f8fa; }
  .layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
  aside { background: #24292f; color: #d0d7de; padding: 20px; }
  aside h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #8b949e; }
  aside ul { list-style: none; padding: 0; margin: 0; }
  aside li a { display: block; padding: 6px 10px; border-radius: 6px; color: #d0d7de; text-decoration: none; font-size: 14px; word-break: break-all; }
  aside li a:hover { background: #30363d; }
  aside li.active a { background: #0969da; color: #fff; }
  main { display: flex; justify-content: center; padding: 32px 16px; }
  .markdown-body { background: #fff; border: 1px solid #d0d7de; border-radius: 8px; padding: 40px; max-width: 860px; width: 100%; line-height: 1.6; }
  .markdown-body h1 { border-bottom: 1px solid #d8dee4; padding-bottom: .3em; }
  .markdown-body h2 { border-bottom: 1px solid #d8dee4; padding-bottom: .3em; }
  .markdown-body a { color: #0969da; }
  .markdown-body code { background: #f6f8fa; padding: .2em .4em; border-radius: 6px; font-size: 85%; }
  .badge { display: inline-block; margin-top: 8px; font-size: 12px; color: #57606a; }
</style>
</head>
<body>
  <div class="layout">
    <aside>
      <h2>Profile files</h2>
      <ul>${nav}</ul>
      <p class="badge">Local preview &middot; AffordaCare profile</p>
    </aside>
    <main><article class="markdown-body">${body}</article></main>
  </div>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    const files = await findMarkdownFiles(ROOT);
    const requested = url.searchParams.get("file");
    const current = files.includes(requested) ? requested : (files.includes("profile/README.md") ? "profile/README.md" : files[0]);
    if (!current) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("No Markdown files found");
      return;
    }
    const raw = await readFile(join(ROOT, current), "utf8");
    const html = page(`${current} · Preview`, md.render(raw), files, current);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`Preview error: ${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Markdown preview running at http://${HOST}:${PORT}`);
});
