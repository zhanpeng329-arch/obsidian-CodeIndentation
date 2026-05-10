# ignoreMD

ignoreMD adds a hover formatting toolbar for Markdown headings, emphasis, lists, links, and code.

## Features

- Shows a compact **Md** button while editing a Markdown file.
- Opens a formatting panel when the pointer hovers over the button.
- Applies common formats without requiring users to type Markdown syntax.
- Supports headings, bold, italic, highlight, quote, unordered lists, ordered lists, task lists, inline code, code blocks, and links.
- Runs locally without telemetry, network calls, or background tasks.

## How to use

1. Open a Markdown file in editing mode.
2. Move the pointer over the **Md** button near the active line or selection.
3. Select a format from the toolbar.

## Install manually

1. Download the release assets `main.js`, `manifest.json`, and `styles.css`.
2. Create this folder in your vault: `.obsidian/plugins/ignoremd/`.
3. Copy the release assets into that folder.
4. Reload the app.
5. Enable **ignoreMD** in **Settings -> Community plugins**.

## Development

Install dependencies:

```bash
npm install
```

Run a development build in watch mode:

```bash
npm run dev
```

Run a production build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Release checklist

1. Update `manifest.json` with the next SemVer version.
2. Update `versions.json` if the minimum supported app version changes.
3. Run `npm run build`.
4. Create a GitHub release whose tag exactly matches the version in `manifest.json`.
5. Attach `manifest.json`, `main.js`, and `styles.css` as individual release assets.

## Community plugin entry

Use this entry when submitting to the community plugin list:

```json
{
	"id": "ignoremd",
	"name": "ignoreMD",
	"author": "zhanpeng329-arch",
	"description": "Adds a hover formatting toolbar for Markdown headings, emphasis, lists, links, and code.",
	"repo": "zhanpeng329-arch/obsidian-CodeIndentation"
}
```

## License

This project is licensed under the terms in `LICENSE`.
