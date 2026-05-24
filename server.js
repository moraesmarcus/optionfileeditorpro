const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".cmd": "text/plain; charset=utf-8",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendFile(response, requestPath) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}

async function fetchTransfermarkt(response, targetUrl) {
  if (!/^https:\/\/(www\.)?transfermarkt\./i.test(targetUrl)) {
    sendJson(response, 400, { ok: false, error: "A URL precisa ser do Transfermarkt." });
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
    });

    if (!upstream.ok) {
      sendJson(response, 502, { ok: false, error: `Transfermarkt respondeu com status ${upstream.status}.` });
      return;
    }

    const html = await upstream.text();
    sendJson(response, 200, { ok: true, html });
  } catch (error) {
    sendJson(response, 502, { ok: false, error: error.message });
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://localhost:${port}`);

  if (requestUrl.pathname === "/fetch") {
    fetchTransfermarkt(response, requestUrl.searchParams.get("url") || "");
    return;
  }

  sendFile(response, decodeURIComponent(requestUrl.pathname));
});

server.listen(port, () => {
  console.log(`Option File Editor Pro: http://localhost:${port}`);
});
