// 導入 Deno 標準庫中的 serve 函數，用於創建 HTTP 服務器
import { serve } from "https://deno.land/std/http/server.ts";

// 啟動 HTTP 服務器，監聽傳入的請求
serve(async (req) => {
  // 解析傳入請求的 URL
  const url = new URL(req.url);
  
  // 構造目標 URL，將請求路徑和查詢參數附加到 GitHub 的域名
  const targetUrl = `https://github.com${url.pathname}${url.search}`;
  
  // 複製原始請求的標頭
  const headers = new Headers(req.headers);
  
  // 確保傳遞 User-Agent（如果客戶端未提供，設置默認值）
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
  }
  
  // 設置必要的標頭以模擬直接訪問 GitHub
  headers.set("Host", "github.com"); // 設置 Host 為 github.com
  headers.set("Origin", "https://github.com"); // 設置 Origin 為 GitHub 域名
  headers.set("Referer", `https://github.com${url.pathname}`); // 設置 Referer 為當前頁面
  
  try {
    // 使用 fetch API 向 GitHub 發送請求
    const response = await fetch(targetUrl, {
      method: req.method, // 使用原始請求的 HTTP 方法（如 GET、POST）
      headers: headers, // 使用修改後的標頭
      body: req.body, // 傳遞原始請求的主體（如表單數據）
      redirect: "manual", // 手動處理重定向以保留控制
    });

    // 創建響應標頭，複製 GitHub 的響應標頭
    const responseHeaders = new Headers(response.headers);
    
    // 添加 CORS 相關標頭，允許跨源請求
    responseHeaders.set("Access-Control-Allow-Origin", "*"); // 允許所有來源（可根據需求限制）
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // 允許的 HTTP 方法
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent, Referer"); // 允許的標頭
    responseHeaders.set("Access-Control-Allow-Credentials", "true"); // 允許攜帶 Cookies

    // 處理 OPTIONS 請求（CORS 預檢請求）
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204, // 無內容響應
        headers: responseHeaders,
      });
    }

    // 確保 Cookies 能夠正確傳遞（GitHub 登錄依賴 Cookies）
    if (response.headers.get("set-cookie")) {
      responseHeaders.set("set-cookie", response.headers.get("set-cookie"));
    }

    // 處理重定向（例如 OAuth 登錄流程中的 302）
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        // 將 GitHub 的重定向 URL 轉換為代理服務器的 URL
        const newLocation = location.replace("https://github.com", url.origin);
        responseHeaders.set("location", newLocation);
      }
    }

    // 返回最終的響應，包含狀態碼、標頭和主體
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // 錯誤處理：返回 500 錯誤並附帶錯誤信息
    console.error("代理請求失敗:", error);
    return new Response("代理服務器錯誤", { status: 500 });
  }
}, { port: 8000 }); // 指定服務器監聽的端口為 8000