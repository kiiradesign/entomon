import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";

const WIKI = "https://en.wikipedia.org";
const START = "/wiki/Butterfly";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Paths Wikipedia's own scripts request relative to the page origin (API, ResourceLoader, REST). */
const PASSTHROUGH = ["/w/", "/api/", "/static/"];

/** Articles previewed in Wikipedia's night theme (the luna moth is a night flier). */
const NIGHT_PAGES = /^\/wiki\/(luna_moth|actias_luna)$/i;

function rewriteHtml(html: string, night: boolean): string {
  html = html.replace(/<meta[^>]+content-security-policy[^>]*>/gi, "");
  if (night) html = html.replace(/(<html[^>]*\b)skin-theme-clientpref-(?:day|os)\b/, "$1skin-theme-clientpref-night");
  html = html.replace(/(["'\s,(])\/\/([a-z0-9.-]+\.(?:wikimedia|wikipedia|mediawiki|wikidata)\.org)/gi, "$1https://$2");
  html = html.replaceAll(`${WIKI}/wiki/`, "/wiki/");
  html = html.replace(/\b(src|srcset|action)=(["'])\/(?!\/|wiki\/)/g, `$1=$2${WIKI}/`);
  html = html.replace(/\bhref=(["'])\/(w|static)\//g, `href=$1${WIKI}/$2/`);
  const tag =
    '<script type="module" src="/@vite/client"></script><script type="module" src="/src/inject.ts"></script>';
  if (html.includes("</body>")) return html.replace("</body>", `${tag}</body>`);
  return html + tag;
}

async function servePage(url: string, res: ServerResponse): Promise<void> {
  const upstream = await fetch(new URL(url, WIKI), {
    headers: { "user-agent": UA, accept: "text/html" },
    redirect: "follow",
  });
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) {
    res.statusCode = 302;
    res.setHeader("Location", upstream.url);
    res.end();
    return;
  }
  const finalPath = new URL(upstream.url).pathname;
  if (finalPath !== new URL(url, WIKI).pathname && finalPath.startsWith("/wiki/")) {
    res.statusCode = 302;
    res.setHeader("Location", finalPath + new URL(upstream.url).search);
    res.end();
    return;
  }
  res.statusCode = upstream.status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  const night = NIGHT_PAGES.test(finalPath);
  if (night) {
    // Wikipedia re-applies a saved theme from this cookie; a path-scoped copy wins on this article only.
    res.setHeader("set-cookie", `enwikimwclientpreferences=skin-theme-clientpref-night; Path=${finalPath}`);
  }
  res.end(rewriteHtml(await upstream.text(), night));
}

async function passThrough(url: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const upstream = await fetch(new URL(url, WIKI), {
    headers: {
      "user-agent": UA,
      accept: req.headers.accept ?? "*/*",
      "accept-language": req.headers["accept-language"] ?? "en",
    },
    redirect: "follow",
  });
  res.statusCode = upstream.status;
  for (const h of ["content-type", "cache-control", "expires", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

export function wikiPreview(): Plugin {
  return {
    name: "entomon-wiki-preview",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const path = url.split("?")[0];
        const get = req.method === "GET" || req.method === "HEAD";

        if (get && (path === "/" || path === "/index.html")) {
          res.statusCode = 302;
          res.setHeader("Location", START);
          res.end();
          return;
        }
        const shortcut = { "/dragonfly": "/wiki/Dragonfly", "/luna-moth": "/wiki/Luna_moth" }[path];
        if (get && shortcut) {
          res.statusCode = 302;
          res.setHeader("Location", shortcut);
          res.end();
          return;
        }
        if (get && path.startsWith("/preview")) {
          res.statusCode = 302;
          res.setHeader("Location", url.slice("/preview".length) || START);
          res.end();
          return;
        }

        const page = get && path.startsWith("/wiki/");
        const api = get && PASSTHROUGH.some((p) => path.startsWith(p));
        if (!page && !api) {
          next();
          return;
        }
        (page ? servePage(url, res) : passThrough(url, req, res)).catch((err: Error) => next(err));
      });
    },
  };
}
