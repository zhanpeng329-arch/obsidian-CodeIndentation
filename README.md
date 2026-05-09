# List Code Block Indent

An Obsidian plugin for keeping fenced code blocks aligned with the current unordered list level.

## What it does

When the cursor is on an empty unordered list item and you paste or type a fenced code block, the plugin removes the empty bullet and keeps the code block at the same indentation level.

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
