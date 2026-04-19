#!/usr/bin/env bun
/**
 * Kimi WebSearch MCP Server
 * 通过 Kimi API 的 web_search_20250305 server tool 提供搜索能力
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── 配置读取 ──────────────────────────────────────────────
function loadConfig() {
  const path = join(homedir(), ".claude", "settings.json");
  const settings = JSON.parse(readFileSync(path, "utf8"));
  return {
    baseUrl: (settings.env?.ANTHROPIC_BASE_URL || "").replace(/\/+$/, ""),
    apiKey: settings.env?.ANTHROPIC_API_KEY || "",
    model: settings.model || "kimi-k2-5-thinking-turbo",
  };
}

const config = loadConfig();

if (!config.baseUrl || !config.apiKey) {
  console.error("错误：~/.claude/settings.json 中未找到 ANTHROPIC_BASE_URL 或 ANTHROPIC_API_KEY");
  process.exit(1);
}

// ── 搜索实现 ──────────────────────────────────────────────
interface SearchResult {
  summary: string;
  links: { title: string; url: string }[];
}

async function doSearch(query: string): Promise<SearchResult> {
  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: query }],
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 错误 ${res.status}: ${text}`);
  }

  const data = await res.json();
  const texts: string[] = [];
  const links: { title: string; url: string }[] = [];

  for (const block of data.content || []) {
    if (block.type === "text") {
      texts.push(block.text);
    }
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.url) {
          links.push({ title: item.title || item.url, url: item.url });
        }
      }
    }
  }

  return { summary: texts.join("\n\n"), links };
}

// ── MCP 服务器 ────────────────────────────────────────────
const server = new McpServer(
  { name: "kimi-websearch-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "web_search",
  {
    description:
      "通过 Kimi API 搜索网络信息。返回模型生成的搜索结果总结以及来源链接列表。" +
      "搜索结果正文被加密无法获取，只能得到总结和链接元数据。" +
      "如需详细内容，可结合 web_fetch 工具抓取具体页面。",
    inputSchema: z.object({
      query: z.string().describe("搜索查询词"),
    }),
  },
  async ({ query }) => {
    if (!query) {
      return {
        content: [{ type: "text" as const, text: "缺少 query 参数" }],
        isError: true,
      };
    }

    try {
      const result = await doSearch(query);

      const textLines = [
        "## 搜索结果总结",
        "",
        result.summary || "（无总结文本）",
        "",
        "## 来源链接",
        "",
      ];
      for (const link of result.links) {
        textLines.push(`- [${link.title}](${link.url})`);
      }

      return {
        content: [{ type: "text" as const, text: textLines.join("\n") }],
        isError: false,
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `搜索失败: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── 启动 ──────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kimi WebSearch MCP Server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
