// 导入 Deno 标准库中的 serve 函数，用于创建 HTTP 服务器
import { serve } from "https://deno.land/std/http/server.ts";

// 定义目标网站的 URL，即要代理的网站
const TARGET_URL = "https://m.uncyclopedia.tw";

// 定义允许的 CORS 源，生产环境中应限制为实际域名（例如 "https://your-project.deno.dev"）
const ALLOWED_ORIGIN = "*"; // 为了安全，建议替换为具体域名

// 默认 User-Agent（如果客户端未提供，可使用此值）
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// 创建 HTTP 服务器，监听端口 8000
serve(async (req) => {
  // 解析传入请求的 URL，提取路径和查询参数
  const url = new URL(req.url);
  const targetPath = url.pathname + url.search;

  // 构建目标 URL
  const targetUrl = `${TARGET_URL}${targetPath}`;

  // 复制客户端的请求头
  const headers = new Headers(req.headers);

  // 确保 User-Agent 存在，若客户端未提供，则使用默认值
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", DEFAULT_USER_AGENT);
  }

  // 确保 Referer 头部正确传递，若无 Referer，可选择设置为目标网站域名
  if (!headers.has("Referer")) {
    headers.set("Referer", TARGET_URL); // 可根据需要调整
  }

  // 创建响应头部，复制目标服务器的头部
  const responseHeaders = new Headers();

  // 添加 CORS 头部以支持跨域请求
  responseHeaders.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  responseHeaders.set("Access-Control-Allow-Credentials", "true"); // 允许传递 Cookies
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, User-Agent, Referer");
  responseHeaders.set("Access-Control-Expose-Headers", "Set-Cookie"); // 允许客户端访问 Set-Cookie 头部

  // 处理 OPTIONS 预检请求，返回 204 状态码
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  try {
    // 转发请求到目标 URL，保留原始请求的方法、头部和主体
    const response = await fetch(targetUrl, {
      method: req.method,    // 保留请求方法（GET、POST 等）
      headers: headers,      // 传递客户端的头部（包括 Cookies、User-Agent、Referer）
      body: req.body,        // 传递请求主体（例如登录表单数据）
      redirect: "manual",    // 手动处理重定向，防止 fetch 自动跟随
    });

    // 复制目标服务器的响应头部
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    // 返回目标服务器的响应，保持状态码、头部和主体
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // 错误处理：如果请求失败，返回 500 状态码和错误信息
    console.error("代理请求失败:", error);
    return new Response("代理请求失败", { status: 500 });
  }
}, { port: 8000 });