import { Plugin } from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";

export function registerHeadingMarkerStyling(plugin: Plugin): void {
	plugin.registerEditorExtension(headingMarkerExtension);
}

const headingMarkerExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildHeadingMarkerDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildHeadingMarkerDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
	}
);

class HeadingMarkerWidget extends WidgetType {
	constructor(private readonly level: number) {
		super();
	}

	eq(other: HeadingMarkerWidget): boolean {
		return other.level === this.level;
	}

	toDOM(): HTMLElement {
		const markerEl = document.createElement("span");
		markerEl.addClass("lcbi-heading-marker");
		markerEl.setText(`H${this.level}`);
		return markerEl;
	}
}

function buildHeadingMarkerDecorations(view: EditorView): DecorationSet {
	const decorations = [];
	let lastLineNumber = 0;

	for (const visibleRange of view.visibleRanges) {
		let line = view.state.doc.lineAt(visibleRange.from);

		while (line.from <= visibleRange.to) {
			if (line.number !== lastLineNumber && !isLineInsideFencedCodeBlock(view, line.number)) {
				const match = line.text.match(/^([ \t]*)(#{1,6})(?=[ \t]|$)/);
				if (match) {
					const indentLength = (match[1] ?? "").length;
					const marker = match[2] ?? "#";
					const from = line.from + indentLength;
					const to = from + marker.length;

					decorations.push(
						Decoration.replace({
							widget: new HeadingMarkerWidget(marker.length),
						}).range(from, to)
					);
				}
			}

			lastLineNumber = line.number;
			if (line.to >= visibleRange.to || line.number >= view.state.doc.lines) {
				break;
			}

			line = view.state.doc.line(line.number + 1);
		}
	}

	return Decoration.set(decorations, true);
}

function isLineInsideFencedCodeBlock(view: EditorView, lineNumber: number): boolean {
	let insideFence = false;

	for (let currentLineNumber = 1; currentLineNumber <= lineNumber; currentLineNumber += 1) {
		const text = view.state.doc.line(currentLineNumber).text.trimStart();
		if (!text.startsWith("```")) {
			continue;
		}

		if (currentLineNumber === lineNumber) {
			return true;
		}

		insideFence = !insideFence;
	}

	return insideFence;
}
