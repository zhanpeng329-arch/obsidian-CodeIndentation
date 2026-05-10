# List Code Block Indent

An Obsidian plugin for improving Markdown editing around lists, headings, and fenced code blocks.

## Features

- Keeps fenced code blocks aligned with the current unordered list level.
- Adds a floating Markdown format menu for headings, lists, tasks, quotes, links, and code blocks.
- Replaces Markdown heading markers with compact `H1` through `H6` labels in live preview editing.
- Adds line numbers and a styled container to rendered fenced code blocks.

## Usage

- Paste or type a fenced code block while the cursor is on an unordered list item to align the code block with the list level.
- Move the pointer over a line in the editor and select the floating format button to change that line into a heading, list item, task, quote, link, or code block.
- Open a note in reading view to see enhanced fenced code block styling and line numbers.

## Code block indentation

When the cursor is on an unordered list item and you paste or type a fenced code block, the plugin keeps the code block aligned with the list level.

Before:

````md
- Trigger conditions
  - GET method
  - |
````

Paste:

````md
```ts
export async function GET() {
  return Response.json({ data: "hello" });
}
```
````

After:

````md
- Trigger conditions
  - GET method

  ```ts
  export async function GET() {
    return Response.json({ data: "hello" });
  }
  ```
````

## Scope

- Supports unordered list markers: `-`, `*`, `+`
- Handles fenced code blocks that start with triple backticks
- Does not detect or wrap raw code
- Does not add commands, settings, ribbon icons, or shortcuts

## Development

Install dependencies:

```bash
npm install
```

Run the development build:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```
