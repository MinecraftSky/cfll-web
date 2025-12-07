// main.ts
// Gemini-CLI 專用 cloudcode-pa.googleapis.com 反向代理
// 首頁顯示使用說明，其餘路徑完全透明代理

const TARGET = "https://cloudcode-pa.googleapis.com";
const CUSTOM_DOMAIN = "https://minecraftsky-gfw-geminicli.deno.dev"; 

const HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini-CLI 代理端點</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 60px auto; padding: 20px; line-height: 1.6; background:#0d1117; color:#c9d1d9; }
    pre { background:#161b22; padding:16px; border-radius:8px; overflow-x:auto; }
    code { background:#161b22; padding:2px 6px; border-radius:4px; }
    a { color:#58a6ff; }
    .highlight { background:#ffdfb6; padding:0.2em 0.4em; border-radius:4px; font-family: monospace; font-size:1.1em; }
  </style>
</head>
<body>
  <h1>Gemini-CLI 代理服務已就緒</h1>
  <p>此地址專門用於代理 <code>cloudcode-pa.googleapis.com</code>，供 <strong>Gemini CLI</strong>（原 Google AI Studio CLI）在中國大陸或其他網路受限地區正常使用。</p>

  <hr>

  <h2>如何使用</h2>
  <p>在你的終端機（Terminal / iTerm / PowerShell / CMD）執行以下兩行指令即可：</p>

  <pre><code>export CODE_ASSIST_ENDPOINT="${CUSTOM_DOMAIN}"
source ~/.bashrc    # 如果你用 zsh 請改成：source ~/.zshrc
</code></pre>

  <p>如果你是 Windows 用戶（CMD）：</p>
  <pre><code>setx CODE_ASSIST_ENDPOINT "${CUSTOM_DOMAIN}"
</code></pre>

  <p>如果你是 Windows PowerShell：</p>
  <pre><code>\( env:CODE_ASSIST_ENDPOINT = " \){CUSTOM_DOMAIN}"
</code></pre>

  <p>設定完成後，直接執行：</p>
  <pre><code>gemini
</code></pre>

  <p>就能正常使用 Gemini CLI 所有功能（寫程式、問問題、REPL、生成 commit message…）</p>

  <hr>

  <small>代理由 Deno Deploy 全球 CDN 提供服務｜完全免費｜不記錄任何內容｜僅轉發流量</small>
</body>
</html>`;

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 40;
const RATE_WINDOW = 1000;

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = rateLimiter.get(ip);
  if (!rec || now > rec.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (rec.count >= RATE_LIMIT) return true;
  rec.count++;
  return false;
}

function generateId() {
  return `\( {Date.now().toString(36)}- \){Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

  // 首頁顯示說明
  if (path === "/" || path === "") {
    return new Response(HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // OPTIONS 預檢直接回
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const targetUrl = `\( {TARGET} \){path}${url.search}`;
  const requestId = generateId();

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("user-agent", "Gemini-CLI-Proxy/1.0");

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      // deno-lint-ignore no-explicit-any
      duplex: req.body ? ("half" as any) : undefined,
      redirect: "follow",
    });

    // 5xx 自動重試一次
    if (response.status >= 500) {
      response = await fetch(targetUrl, { method: req.method, headers, body: req.body, duplex: req.body ? ("half" as any) : undefined });
    }
  } catch (e) {
    console.error(`[${requestId}] Fetch failed:`, e);
    return new Response("Bad Gateway", { status: 502, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Expose-Headers", "*");
  newHeaders.delete("server");
  newHeaders.delete("via");
  newHeaders.set("x-proxy-by", "deno-gemini-cli");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});