/* CLOVE local static server — zero dependencies. */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const HOST = "127.0.0.1";
const PREFIX = "/clove";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch (err) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(302, { Location: PREFIX + "/" });
    res.end();
    return;
  }

  if (pathname === PREFIX) {
    res.writeHead(301, { Location: PREFIX + "/" });
    res.end();
    return;
  }

  if (!pathname.startsWith(PREFIX + "/")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found. Start at http://localhost:" + PORT + PREFIX + "/");
    return;
  }

  const relative = pathname.slice(PREFIX.length + 1) || "index.html";
  const filePath = path.resolve(ROOT, relative);
  const withinRoot = filePath === ROOT || filePath.startsWith(ROOT + path.sep);

  if (!withinRoot) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache, no-store, must-revalidate"
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(data);
    }
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. The site may already be running.`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`CLOVE is running at http://localhost:${PORT}${PREFIX}/`);
});
