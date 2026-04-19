#!/usr/bin/env bun
/**
 * 测试脚本：验证通过 Kimi Anthropic 兼容端点调用 web_search
 * 用法：bun run test.ts "今天的新闻"
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── 读取 ~/.claude/settings.json ──────────────────────────
function loadConfig() {
  const path = join(homedir(), ".claude", "settings.json");
  const settings = JSON.parse(readFileSync(path, "utf8"));
  return {
    baseUrl: (settings.env?.ANTHROPIC_BASE_URL || "").replace(/\/+$/, ""),
    apiKey: settings.env?.ANTHROPIC_API_KEY || "",
    model: settings.model || "claude-sonnet-4-6",
  };
}

const config = loadConfig();
const query = process.argv[2];

if (!query) {
  console.error("用法: bun run test.ts <查询词>");
  process.exit(1);
}

if (!config.baseUrl || !config.apiKey) {
  console.error("错误：未找到 ANTHROPIC_BASE_URL 或 ANTHROPIC_API_KEY");
  process.exit(1);
}

console.log(`→ 查询: ${query}\n`);

// ── 调用 API ──────────────────────────────────────────────
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
  console.error(`API 错误 ${res.status}:`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();

// ── 解析输出 ──────────────────────────────────────────────
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

console.log("=".repeat(60));
console.log("模型总结");
console.log("=".repeat(60));
console.log(texts.join("\n\n") || "(无总结文本)");

if (links.length) {
  console.log("\n" + "=".repeat(60));
  console.log(`来源链接 (${links.length} 条)`);
  console.log("=".repeat(60));
  for (const l of links) {
    console.log(`- ${l.title}`);
    console.log(`  ${l.url}`);
  }
}

console.log("\n✅ 调用成功");