# kimi-websearch-mcp

通过 Kimi API 的 `web_search_20250305` server tool 提供 MCP 搜索能力。

## 背景

Claude Code 在非官方 API（如 Kimi）下，内置 WebSearch 会降级到 Bing 适配器，在国内/WSL 网络下无法访问。Kimi 的 Anthropic 兼容端点实际支持 `web_search_20250305`，但返回的搜索正文是加密的，只能获取模型总结和链接元数据。

这个 MCP server 把 Kimi 的搜索能力桥接到 Claude Code。

## 功能

- `web_search`：调用 Kimi API 搜索，返回模型总结 + 来源链接列表

## 安装

```bash
# clone
git clone https://github.com/quei4r/kimi-websearch-mcp.git
cd kimi-websearch-mcp

# 依赖
npm install

# 需要 Bun 或 Node.js 运行
```

## 配置

确保 `~/.claude/settings.json` 已配置 Kimi API：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding",
    "ANTHROPIC_API_KEY": "sk-kimi-..."
  }
}
```

### 方法一：CLI 添加（推荐）

```bash
claude mcp add -s user kimi-websearch bun /absolute/path/to/kimi-websearch-mcp/index.ts
```

### 方法二：手动编辑配置

在 `~/.claude/mcp-config.json` 中添加：

```json
{
  "mcpServers": {
    "kimi-websearch": {
      "command": "bun",
      "args": ["/absolute/path/to/kimi-websearch-mcp/index.ts"]
    }
  }
}
```

重启 Claude Code 即可。

## 用法

在 Claude Code 对话中直接提问需要搜索的内容，模型会自动调用 `web_search` 工具。

示例：

> "2026年4月有什么科技新闻？"

返回格式：

```markdown
## 搜索结果总结

...模型生成的总结...

## 来源链接

- [标题1](https://...)
- [标题2](https://...)
```

## 限制

- 搜索结果正文加密，只能获取总结和链接元数据
- 如需原始搜索明文，需换用 DuckDuckGo/Bing API 等开放搜索源
- 依赖 Kimi API 的 `web_search_20250305` server tool 可用性

## 技术栈

- TypeScript
- `@modelcontextprotocol/sdk`
- `zod`
- Bun / Node.js

## License

MIT
