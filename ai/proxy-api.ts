import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 定义支持的 API 端点及其配置，包括默认端点
const apiEndpoints = {
  chatgpt: {
    prefix: "/chatgpt",
    base: "https://api.openai.com/v1/",
    defaultPath: "v1/chat/completions", // 默认转发到 ChatGPT 对话端点
  },
  claude: {
    prefix: "/claude",
    base: "https://api.anthropic.com/",
    defaultPath: "v1/messages", // 默认转发到 Claude 消息端点
  },
  gemini: {
    prefix: "/gemini",
    base: "https://generativelanguage.googleapis.com/",
    defaultPath: "v1beta/chat/completions", // 默认转发到 Gemini 对话端点
  },
  grok: {
    prefix: "/grok",
    base: "https://api.x.ai/v1/",
    defaultPath: "v1/chat/completions", // 默认转发到 Grok 对话端点
  },
};

// 异步处理函数，处理所有传入的 HTTP 请求
async function handler(req: Request): Promise<Response> {
  const incomingUrl = new URL(req.url);
  const path = incomingUrl.pathname;

  // 处理根路径请求
  if (path === "/") {
    return new Response(
      "此地址用于代理 ChatGPT、Claude、Gemini 和 Grok API。\n请分别使用 /chatgpt/、/claude/、/gemini/、/grok/ 前缀。",
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  // 根据路径前缀确定 API 类型
  let apiType = null;
  let targetPath = null;
  for (const [type, config] of Object.entries(apiEndpoints)) {
    if (path.startsWith(config.prefix)) {
      apiType = type;
      targetPath = path.slice(config.prefix.length);
      if (targetPath.startsWith("/")) {
        targetPath = targetPath.slice(1); // 移除路径开头的斜杠（如果存在）
      }
      break;
    }
  }

  // 如果未找到匹配的 API 类型，返回错误
  if (!apiType) {
    return new Response("无效的 API 路径，必须以 /chatgpt/、/claude/、/gemini/ 或 /grok/ 开头。", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 如果路径为空（即 /<api> 或 /<api>/），使用默认端点
  if (targetPath === "" || targetPath === "/") {
    targetPath = apiEndpoints[apiType].defaultPath;

    // 对于 Gemini，检查正文中的 model 字段
    if (apiType === "gemini" && req.method === "POST" && req.body) {
      try {
        // 读取请求正文以提取模型
        const bodyText = await req.text();
        const body = JSON.parse(bodyText);
        const model = body.model;
        if (!model) {
          return new Response("Gemini 请求必须在正文中指定 'model' 字段，例如 'gemini-1.5-pro'。", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        // 重置请求正文以确保流式传输
        req = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: bodyText,
        });
      } catch (error) {
        console.error(`解析 Gemini 请求正文失败: ${error.message}`);
        return new Response("Gemini 请求正文无效，必须为有效的 JSON 格式并包含 'model' 字段。", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }
  }

  // 构造目标 API 的完整 URL
  const baseUrl = apiEndpoints[apiType].base;
  const targetUrlString = `${baseUrl}${targetPath}${incomingUrl.search}`;

  console.log(`代理请求到: ${targetUrlString}`); // 调试日志

  try {
    // 转发请求到目标 API
    const response = await fetch(targetUrlString, {
      headers: req.headers, // 转发原始请求头（包括 API 密钥）
      method: req.method, // 转发原始请求方法
      body: req.body, // 转发原始请求正文（支持流式传输）
      redirect: "manual", // 不自动跟随重定向
    });

    // 设置响应中的 CORS 头
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*"); // 允许任意来源
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // 允许的请求方法
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version, *"); // 允许的请求头

    // 处理 CORS 预检请求（OPTIONS）
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204, // 无内容
        headers: responseHeaders,
      });
    }

    // 返回目标 API 的响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // 处理请求转发中的错误
    console.error(`请求 ${targetUrlString} 失败:`, error);
    return new Response(`无法代理请求到 ${targetUrlString}: ${error.message}`, {
      status: 502, // 网关错误
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

console.log("此地址用于帮助 astrbot 更快连接 ChatGPT、Claude、Gemini 和 Grok API");
// 启动服务器，默认端口 8000 或 Deno Deploy 分配的端口
serve(handler);