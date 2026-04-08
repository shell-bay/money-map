# Chrome DevTools MCP Setup Guide

## Prerequisites (on your computer)

1. **Node.js v20.19+** - Download from https://nodejs.org
2. **Google Chrome** - Download from https://google.com/chrome
3. **Claude Code CLI** installed on your computer

## Installation Steps

### 1. Add MCP Configuration to Claude Code

On your computer (not Android), find your Claude Code settings file:

- **macOS/Linux**: `~/.claude/settings.json`
- **Windows**: `%USERPROFILE%\.claude\settings.json`

Add or merge the following:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

If you already have an `mcpServers` section, just add the `"chrome-devtools"` entry.

### 2. Reload Claude Code Plugins

Run in terminal:
```bash
claude-code --reload-plugins
```
Or restart Claude Code.

### 3. Verify Installation

In Claude Code, try this prompt:
```
Check the performance of https://developers.chrome.com
```

You should see Chrome open and a performance trace being recorded.

## Optional Configuration

### Headless Mode (no visible browser):
```json
"args": ["-y", "chrome-devtools-mcp@latest", "--headless"]
```

### Use Existing Chrome Instance:
```json
"args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
```

Then start Chrome manually:
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile
```

### All Available Options:
- `--isolated` - Use temporary profile (auto-cleaned)
- `--channel=canary|beta|dev` - Use different Chrome channel
- `--executablePath=/path/to/chrome` - Custom Chrome location
- `--viewport=1280x720` - Set viewport size
- `--slim` - Minimal tools only (navigation, screenshots, script)

Full list: Run `npx chrome-devtools-mcp@latest --help`

## Troubleshooting

### "Chrome not found"
Make sure Chrome is installed and in your PATH. Test: `google-chrome --version`

### "npx: command not found"
Node.js not installed correctly. Verify: `node --version` should show v20.19+

### Port already in use
Kill existing Chrome processes or use `--isolated` flag.

### Connection refused
Make sure no firewall is blocking port 9222.

## Tools Available

Once configured, you have access to:
- **Navigation**: new_page, close_page, list_pages, navigate_page
- **Automation**: click, type_text, fill, hover, drag, press_key
- **Debugging**: evaluate_script, get_console_message, take_screenshot
- **Performance**: performance_start_trace, performance_analyze_insight
- **Network**: list_network_requests, get_network_request
- **Emulation**: emulate, resize_page

## Usage Examples

```
Take a screenshot of https://example.com
```
```
Click the login button
```
```
Analyze the performance of https://my-site.com
```
```
Get all network requests from the current page
```
