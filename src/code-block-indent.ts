import { Editor, Plugin } from "obsidian";

const EMPTY_UNORDERED_LIST_ITEM = /^([ \t]*)[-*+][ \t]*$/;
const NON_EMPTY_UNORDERED_LIST_ITEM = /^([ \t]*)[-*+][ \t]+\S.*$/;
const UNORDERED_LIST_ITEM_WITH_FENCE = /^([ \t]*)[-*+][ \t]+(```.*)$/;
const NON_EMPTY_UNORDERED_LIST_ITEM_WITH_FENCE = /^([ \t]*[-*+][ \t]+)(.*\S)(```.*)$/;
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
	if (listItemMatch) {
		const indent = getMarkdownSafeFenceIndent(listItemMatch[1] ?? "");
		evt.preventDefault();

		replaceLineWithIndentedBlock(editor, cursor.line, lineText, indent, fencedCodeBlock);
		return true;
	}

	const lineBeforeCursor = lineText.slice(0, cursor.ch);
	const lineAfterCursor = lineText.slice(cursor.ch);
	const nonEmptyListItemMatch = lineBeforeCursor.match(NON_EMPTY_UNORDERED_LIST_ITEM);
	if (!nonEmptyListItemMatch || lineAfterCursor.trim()) {
		return false;
	}

	const indent = getMarkdownSafeFenceIndent(nonEmptyListItemMatch[1] ?? "");
	evt.preventDefault();

	insertIndentedBlockAfterCursor(editor, cursor.line, cursor.ch, indent, fencedCodeBlock);
	return true;
}

export function formatTypedFenceStart(editor: Editor): boolean {
	if (editor.somethingSelected()) {
		return false;
	}

	const cursor = editor.getCursor();
	const lineText = editor.getLine(cursor.line);
	const lineMatch = lineText.match(UNORDERED_LIST_ITEM_WITH_FENCE);
	if (lineMatch) {
		const indent = getMarkdownSafeFenceIndent(lineMatch[1] ?? "");
		const fenceStart = lineMatch[2] ?? "";
		if (!fenceStart.startsWith("```")) {
			return false;
		}

		const replacement = `\n${indent}${fenceStart}`;
		replaceLine(editor, cursor.line, lineText, replacement);
		return true;
	}

	const nonEmptyLineMatch = lineText.match(NON_EMPTY_UNORDERED_LIST_ITEM_WITH_FENCE);
	if (!nonEmptyLineMatch) {
		return false;
	}

	const listItemText = `${nonEmptyLineMatch[1] ?? ""}${nonEmptyLineMatch[2] ?? ""}`;
	const fenceStart = nonEmptyLineMatch[3] ?? "";
	const indentMatch = listItemText.match(/^([ \t]*)/);
	const indent = getMarkdownSafeFenceIndent(indentMatch?.[1] ?? "");
	const replacement = `${listItemText}\n\n${indent}${fenceStart}`;
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

function insertIndentedBlockAfterCursor(
	editor: Editor,
	lineNumber: number,
	ch: number,
	indent: string,
	fencedCodeBlock: string
): void {
	const indentedBlock = fencedCodeBlock
		.split("\n")
		.map((line) => `${indent}${line}`)
		.join("\n");
	const replacement = `\n\n${indentedBlock}`;

	editor.replaceRange(replacement, { line: lineNumber, ch }, undefined, FORMAT_ORIGIN);

	const replacementLines = replacement.split("\n");
	const lastReplacementLine = replacementLines[replacementLines.length - 1] ?? "";
	editor.setCursor({
		line: lineNumber + replacementLines.length - 1,
		ch: lastReplacementLine.length,
	});
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

function getMarkdownSafeFenceIndent(indent: string): string {
	const spaceCount = countLeadingSpaces(indent);
	return " ".repeat(Math.min(spaceCount, 3));
}

function countLeadingSpaces(indent: string): number {
	let spaces = 0;

	for (const char of indent) {
		if (char === "\t") {
			spaces += 4 - (spaces % 4);
			continue;
		}

		spaces += 1;
	}

	return spaces;
}
