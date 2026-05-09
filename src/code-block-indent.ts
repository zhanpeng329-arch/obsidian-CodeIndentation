import { Editor, Plugin } from "obsidian";

const EMPTY_UNORDERED_LIST_ITEM = /^([ \t]*)[-*+][ \t]*$/;
const UNORDERED_LIST_ITEM_WITH_FENCE = /^([ \t]*)[-*+][ \t]+(```.*)$/;
const FORMAT_ORIGIN = "list-code-block-indent";

export function registerCodeBlockIndenting(plugin: Plugin): void {
	let isApplyingFormat = false;

	const applyFormat = (format: () => boolean): boolean => {
		if (isApplyingFormat) {
			return false;
		}

		isApplyingFormat = true;
		try {
			return format();
		} finally {
			isApplyingFormat = false;
		}
	};

	plugin.registerEvent(
		plugin.app.workspace.on("editor-paste", (evt, editor) => {
			applyFormat(() => formatPastedFencedCodeBlock(evt, editor));
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on("editor-change", (editor) => {
			applyFormat(() => formatTypedFenceStart(editor));
		})
	);
}

export function formatPastedFencedCodeBlock(evt: ClipboardEvent, editor: Editor): boolean {
	if (editor.somethingSelected()) {
		return false;
	}

	const pastedText = evt.clipboardData?.getData("text/plain") ?? "";
	const fencedCodeBlock = normalizeFencedCodeBlock(pastedText);
	if (!fencedCodeBlock) {
		return false;
	}

	const cursor = editor.getCursor();
	const lineText = editor.getLine(cursor.line);
	const listItemMatch = lineText.match(EMPTY_UNORDERED_LIST_ITEM);
	if (!listItemMatch) {
		return false;
	}

	const indent = listItemMatch[1] ?? "";
	evt.preventDefault();

	replaceLineWithIndentedBlock(editor, cursor.line, lineText, indent, fencedCodeBlock);
	return true;
}

export function formatTypedFenceStart(editor: Editor): boolean {
	if (editor.somethingSelected()) {
		return false;
	}

	const cursor = editor.getCursor();
	const lineText = editor.getLine(cursor.line);
	const lineMatch = lineText.match(UNORDERED_LIST_ITEM_WITH_FENCE);
	if (!lineMatch) {
		return false;
	}

	const indent = lineMatch[1] ?? "";
	const fenceStart = lineMatch[2] ?? "";
	if (!fenceStart.startsWith("```")) {
		return false;
	}

	const replacement = `\n${indent}${fenceStart}`;
	replaceLine(editor, cursor.line, lineText, replacement);
	return true;
}

function replaceLineWithIndentedBlock(
	editor: Editor,
	lineNumber: number,
	lineText: string,
	indent: string,
	fencedCodeBlock: string
): void {
	const indentedBlock = fencedCodeBlock
		.split("\n")
		.map((line) => `${indent}${line}`)
		.join("\n");

	replaceLine(editor, lineNumber, lineText, `\n${indentedBlock}`);
}

function replaceLine(editor: Editor, lineNumber: number, lineText: string, replacement: string): void {
	editor.replaceRange(
		replacement,
		{ line: lineNumber, ch: 0 },
		{ line: lineNumber, ch: lineText.length },
		FORMAT_ORIGIN
	);

	const replacementLines = replacement.split("\n");
	const lastReplacementLine = replacementLines[replacementLines.length - 1] ?? "";
	editor.setCursor({
		line: lineNumber + replacementLines.length - 1,
		ch: lastReplacementLine.length,
	});
}

function normalizeFencedCodeBlock(text: string): string | null {
	const normalized = text
		.replace(/\r\n?/g, "\n")
		.replace(/^(?:[ \t]*\n)+/, "")
		.replace(/\n+$/, "");

	if (!normalized) {
		return null;
	}

	const lines = normalized.split("\n");
	const openingFenceMatch = lines[0]?.match(/^([ \t]*)```/);
	if (!openingFenceMatch) {
		return null;
	}

	const sourceIndent = openingFenceMatch[1] ?? "";
	return lines.map((line) => removePrefix(line, sourceIndent)).join("\n");
}

function removePrefix(text: string, prefix: string): string {
	if (!prefix || !text.startsWith(prefix)) {
		return text;
	}

	return text.slice(prefix.length);
}
