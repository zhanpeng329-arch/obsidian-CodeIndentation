import { Plugin, setIcon } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

type FormatAction =
	| "text"
	| "heading"
	| "bullet"
	| "numbered"
	| "todo"
	| "code"
	| "quote"
	| "link";

type RowAction =
	| "indent"
	| "color"
	| "cut"
	| "copy"
	| "translate"
	| "delete"
	| "share"
	| "child-doc"
	| "template"
	| "copy-link"
	| "add-below";

interface FormatItem {
	action: FormatAction;
	label: string;
	icon?: string;
	level?: number;
}

interface RowItem {
	action: RowAction;
	label: string;
	icon: string;
	chevron?: boolean;
	disabled?: boolean;
}

type MenuSection =
	| { type: "formats"; items: FormatItem[] }
	| { type: "rows"; items: RowItem[] };

const FLOATING_BUTTON_WIDTH = 72;
const FLOATING_BUTTON_GAP = 6;

const MENU_SECTIONS: MenuSection[] = [
	{
		type: "formats",
		items: [
			{ action: "text", label: "T" },
			{ action: "heading", label: "H1", level: 1 },
			{ action: "heading", label: "H2", level: 2 },
			{ action: "heading", label: "H3", level: 3 },
			{ action: "heading", label: "H4", level: 4 },
			{ action: "heading", label: "H5", level: 5 },
			{ action: "heading", label: "H6", level: 6 },
			{ action: "numbered", label: "有序", icon: "list-ordered" },
			{ action: "bullet", label: "无序", icon: "list" },
			{ action: "todo", label: "待办", icon: "square-check" },
			{ action: "code", label: "代码", icon: "braces" },
			{ action: "quote", label: "引用", icon: "quote" },
			{ action: "link", label: "链接", icon: "link" },
		],
	},
	{
		type: "rows",
		items: [
			{ action: "indent", label: "缩进和对齐", icon: "align-left", chevron: true, disabled: true },
			{ action: "color", label: "颜色", icon: "palette", chevron: true, disabled: true },
		],
	},
	{
		type: "rows",
		items: [
			{ action: "cut", label: "剪切", icon: "scissors" },
			{ action: "copy", label: "复制", icon: "copy" },
			{ action: "translate", label: "翻译", icon: "languages", disabled: true },
			{ action: "delete", label: "删除", icon: "trash-2" },
		],
	},
	{
		type: "rows",
		items: [
			{ action: "share", label: "分享", icon: "send", disabled: true },
			{ action: "child-doc", label: "转换为子文档", icon: "file-plus-2", disabled: true },
			{ action: "template", label: "保存为模板", icon: "boxes", disabled: true },
			{ action: "copy-link", label: "复制链接", icon: "link", disabled: true },
		],
	},
	{
		type: "rows",
		items: [{ action: "add-below", label: "在下方添加", icon: "plus-square", chevron: true }],
	},
];

export function registerBlockFormatMenu(plugin: Plugin): void {
	plugin.registerEditorExtension(blockFormatMenuExtension);
}

interface FloatingButtonParts {
	buttonEl: HTMLButtonElement;
	labelEl: HTMLSpanElement;
}

const blockFormatMenuExtension = ViewPlugin.fromClass(
	class {
		private readonly buttonEl: HTMLButtonElement;
		private readonly buttonLabelEl: HTMLSpanElement;
		private readonly menuEl: HTMLDivElement;
		private activeLineFrom: number | null = null;
		private menuOpen = false;
		private closeMenuTimeout: number | null = null;

		constructor(private readonly view: EditorView) {
			const floatingButton = this.createFloatingButton();
			this.buttonEl = floatingButton.buttonEl;
			this.buttonLabelEl = floatingButton.labelEl;
			this.menuEl = document.createElement("div");
			this.menuEl.addClass("lcbi-block-menu");
			this.menuEl.hide();
			this.renderMenu();

			document.body.appendChild(this.buttonEl);
			document.body.appendChild(this.menuEl);

			this.view.dom.addEventListener("mousemove", this.handleMouseMove);
			this.view.dom.addEventListener("mouseleave", this.handleMouseLeave);
			this.view.scrollDOM.addEventListener("scroll", this.handleScroll);
			this.buttonEl.addEventListener("mousedown", this.handleFloatingUiMouseDown);
			this.menuEl.addEventListener("mousedown", this.handleFloatingUiMouseDown);
			this.buttonEl.addEventListener("click", this.handleButtonClick);
			this.buttonEl.addEventListener("mouseenter", this.handleFloatingUiMouseEnter);
			this.buttonEl.addEventListener("mouseleave", this.handleFloatingUiMouseLeave);
			this.menuEl.addEventListener("mouseenter", this.handleFloatingUiMouseEnter);
			this.menuEl.addEventListener("mouseleave", this.handleFloatingUiMouseLeave);
			document.addEventListener("mousedown", this.handleDocumentMouseDown, true);
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged) {
				this.hideMenu();
				this.hideButton();
			}
		}

		destroy(): void {
			this.view.dom.removeEventListener("mousemove", this.handleMouseMove);
			this.view.dom.removeEventListener("mouseleave", this.handleMouseLeave);
			this.view.scrollDOM.removeEventListener("scroll", this.handleScroll);
			this.buttonEl.removeEventListener("mousedown", this.handleFloatingUiMouseDown);
			this.menuEl.removeEventListener("mousedown", this.handleFloatingUiMouseDown);
			this.buttonEl.removeEventListener("click", this.handleButtonClick);
			this.buttonEl.removeEventListener("mouseenter", this.handleFloatingUiMouseEnter);
			this.buttonEl.removeEventListener("mouseleave", this.handleFloatingUiMouseLeave);
			this.menuEl.removeEventListener("mouseenter", this.handleFloatingUiMouseEnter);
			this.menuEl.removeEventListener("mouseleave", this.handleFloatingUiMouseLeave);
			document.removeEventListener("mousedown", this.handleDocumentMouseDown, true);
			this.clearCloseMenuTimeout();
			this.buttonEl.remove();
			this.menuEl.remove();
		}

		private createFloatingButton(): FloatingButtonParts {
			const buttonEl = document.createElement("button");
			buttonEl.type = "button";
			buttonEl.addClass("lcbi-block-menu-button");
			buttonEl.setAttr("aria-label", "打开 Markdown 格式菜单");

			const labelEl = buttonEl.createSpan({ cls: "lcbi-block-menu-button-label", text: "T" });
			buttonEl.createSpan({ cls: "lcbi-block-menu-button-grip", text: "⋮⋮" });

			const chevronEl = buttonEl.createSpan({ cls: "lcbi-block-menu-button-chevron" });
			setIcon(chevronEl, "chevron-down");

			buttonEl.hide();

			return { buttonEl, labelEl };
		}

		private readonly handleMouseMove = (evt: MouseEvent): void => {
			if (this.menuOpen) {
				return;
			}

			const pos = this.view.posAtCoords({ x: evt.clientX, y: evt.clientY });
			if (pos === null) {
				this.hideButton();
				return;
			}

			const line = this.view.state.doc.lineAt(pos);
			if (this.activeLineFrom !== line.from) {
				this.activeLineFrom = line.from;
				this.buttonLabelEl.setText(getLineFormatLabel(this.view.state.doc, line.number));
			}
			this.showButtonForLine(line.from);
		};

		private readonly handleMouseLeave = (evt: MouseEvent): void => {
			const relatedTarget = evt.relatedTarget;
			if (
				relatedTarget instanceof Node &&
				(this.buttonEl.contains(relatedTarget) || this.menuEl.contains(relatedTarget))
			) {
				return;
			}

			if (this.menuOpen) {
				this.scheduleMenuClose();
				return;
			}

			this.hideButton();
		};

		private readonly handleScroll = (): void => {
			this.hideMenu();
			this.hideButton();
		};

		private readonly handleButtonClick = (evt: MouseEvent): void => {
			evt.preventDefault();
			evt.stopPropagation();
			this.showMenu();
		};

		private readonly handleFloatingUiMouseDown = (evt: MouseEvent): void => {
			evt.preventDefault();
		};

		private readonly handleFloatingUiMouseEnter = (): void => {
			this.clearCloseMenuTimeout();
			this.showMenu();
		};

		private readonly handleFloatingUiMouseLeave = (): void => {
			this.scheduleMenuClose();
		};

		private readonly handleDocumentMouseDown = (evt: MouseEvent): void => {
			const target = evt.target;
			if (!(target instanceof Node)) {
				return;
			}

			if (this.buttonEl.contains(target) || this.menuEl.contains(target)) {
				return;
			}

			this.hideMenu();
		};

		private renderMenu(): void {
			this.menuEl.empty();

			for (const [sectionIndex, section] of MENU_SECTIONS.entries()) {
				if (sectionIndex > 0) {
					this.menuEl.createDiv({ cls: "lcbi-block-menu-separator" });
				}

				if (section.type === "formats") {
					this.renderFormatSection(section.items);
				} else {
					this.renderRowSection(section.items);
				}
			}
		}

		private renderFormatSection(items: FormatItem[]): void {
			const sectionEl = this.menuEl.createDiv({ cls: "lcbi-block-menu-format-grid" });

			for (const item of items) {
				const itemEl = document.createElement("button");
				itemEl.type = "button";
				itemEl.addClass("lcbi-block-menu-format");
				itemEl.setAttr("aria-label", item.label);

				if (item.icon) {
					setIcon(itemEl, item.icon);
				} else {
					itemEl.setText(item.label);
				}

				itemEl.addEventListener("click", (evt) => {
					evt.preventDefault();
					evt.stopPropagation();
					this.applyFormat(item);
				});
				sectionEl.appendChild(itemEl);
			}
		}

		private renderRowSection(items: RowItem[]): void {
			const sectionEl = this.menuEl.createDiv({ cls: "lcbi-block-menu-row-section" });

			for (const item of items) {
				const itemEl = document.createElement("button");
				itemEl.type = "button";
				itemEl.addClass("lcbi-block-menu-row");
				if (item.disabled) {
					itemEl.addClass("is-disabled");
					itemEl.disabled = true;
				}

				const iconEl = itemEl.createSpan({ cls: "lcbi-block-menu-row-icon" });
				setIcon(iconEl, item.icon);
				itemEl.createSpan({ cls: "lcbi-block-menu-row-label", text: item.label });

				if (item.chevron) {
					const chevronEl = itemEl.createSpan({ cls: "lcbi-block-menu-row-chevron" });
					setIcon(chevronEl, "chevron-right");
				}

				itemEl.addEventListener("click", (evt) => {
					evt.preventDefault();
					evt.stopPropagation();
					this.applyRowAction(item);
				});
				sectionEl.appendChild(itemEl);
			}
		}

		private showButtonForLine(lineFrom: number): void {
			const coords = this.view.coordsAtPos(lineFrom);
			if (!coords) {
				this.hideButton();
				return;
			}

			const editorRect = this.view.dom.getBoundingClientRect();
			this.buttonEl.style.left = `${Math.max(
				editorRect.left + FLOATING_BUTTON_GAP,
				coords.left - FLOATING_BUTTON_WIDTH - FLOATING_BUTTON_GAP
			)}px`;
			this.buttonEl.style.top = `${coords.top - 3}px`;
			this.buttonEl.show();
		}

		private hideButton(): void {
			if (!this.buttonEl.isShown()) {
				return;
			}

			this.buttonEl.hide();
			this.activeLineFrom = null;
		}

		private showMenu(): void {
			if (this.activeLineFrom === null) {
				return;
			}

			this.clearCloseMenuTimeout();
			const buttonRect = this.buttonEl.getBoundingClientRect();
			const menuWidth = 266;
			const preferredLeft = buttonRect.left - menuWidth - 8;
			const fallbackLeft = buttonRect.right + 8;
			const left = preferredLeft >= 8 ? preferredLeft : fallbackLeft;
			const maxTop = window.innerHeight - 486;

			this.menuEl.style.left = `${left}px`;
			this.menuEl.style.top = `${Math.max(8, Math.min(buttonRect.top - 6, maxTop))}px`;
			this.menuEl.show();
			this.menuOpen = true;
		}

		private hideMenu(): void {
			this.clearCloseMenuTimeout();
			if (!this.menuOpen) {
				return;
			}

			this.menuEl.hide();
			this.menuOpen = false;
		}

		private scheduleMenuClose(): void {
			this.clearCloseMenuTimeout();
			this.closeMenuTimeout = window.setTimeout(() => {
				this.closeMenuTimeout = null;
				this.hideMenu();
				this.hideButton();
			}, 180);
		}

		private clearCloseMenuTimeout(): void {
			if (this.closeMenuTimeout === null) {
				return;
			}

			window.clearTimeout(this.closeMenuTimeout);
			this.closeMenuTimeout = null;
		}

		private applyFormat(item: FormatItem): void {
			if (this.activeLineFrom === null) {
				return;
			}

			const line = this.view.state.doc.lineAt(this.activeLineFrom);
			if (item.action === "code") {
				this.applyCodeBlockFormat(line.from, line.to, line.text);
			} else {
				this.applyLineFormat(line.from, line.to, line.text, item);
			}

			this.hideMenu();
			this.hideButton();
			this.view.focus();
		}

		private applyRowAction(item: RowItem): void {
			if (item.disabled || this.activeLineFrom === null) {
				return;
			}

			switch (item.action) {
				case "cut":
					this.copyCurrentLine();
					this.deleteCurrentLine();
					break;
				case "copy":
					this.copyCurrentLine();
					break;
				case "delete":
					this.deleteCurrentLine();
					break;
				case "add-below":
					this.addLineBelow();
					break;
				case "indent":
				case "color":
				case "translate":
				case "share":
				case "child-doc":
				case "template":
				case "copy-link":
					break;
			}

			this.hideMenu();
			this.hideButton();
			this.view.focus();
		}

		private applyLineFormat(from: number, to: number, lineText: string, item: FormatItem): void {
			const { indent, content } = stripMarkdownBlockMarker(lineText);
			const replacement = item.action === "link"
				? `${indent}${content ? `[${content}]()` : "[]()"}`
				: `${indent}${getMarkdownPrefix(item)}${content}`;
			const cursorOffset = item.action === "link"
				? replacement.length - 1
				: replacement.length;

			this.view.dispatch({
				changes: { from, to, insert: replacement },
				selection: { anchor: from + cursorOffset },
			});
		}

		private applyCodeBlockFormat(from: number, to: number, lineText: string): void {
			const { indent, content } = stripMarkdownBlockMarker(lineText);
			const fenceIndent = getMarkdownSafeFenceIndent(indent);
			const replacement = content
				? `${fenceIndent}\`\`\`\n${fenceIndent}${content}\n${fenceIndent}\`\`\``
				: `${fenceIndent}\`\`\`\n${fenceIndent}\n${fenceIndent}\`\`\``;
			const cursorOffset = content
				? replacement.length
				: `${fenceIndent}\`\`\`\n${fenceIndent}`.length;

			this.view.dispatch({
				changes: { from, to, insert: replacement },
				selection: { anchor: from + cursorOffset },
			});
		}

		private copyCurrentLine(): void {
			if (this.activeLineFrom === null) {
				return;
			}

			const line = this.view.state.doc.lineAt(this.activeLineFrom);
			void navigator.clipboard?.writeText(line.text);
		}

		private deleteCurrentLine(): void {
			if (this.activeLineFrom === null) {
				return;
			}

			const doc = this.view.state.doc;
			const line = doc.lineAt(this.activeLineFrom);
			const from = line.number < doc.lines ? line.from : Math.max(0, line.from - 1);
			const to = line.number < doc.lines ? doc.line(line.number + 1).from : line.to;

			this.view.dispatch({
				changes: { from, to },
				selection: { anchor: from },
			});
		}

		private addLineBelow(): void {
			if (this.activeLineFrom === null) {
				return;
			}

			const line = this.view.state.doc.lineAt(this.activeLineFrom);
			this.view.dispatch({
				changes: { from: line.to, insert: "\n" },
				selection: { anchor: line.to + 1 },
			});
		}
	}
);

function getMarkdownPrefix(item: FormatItem): string {
	switch (item.action) {
		case "heading":
			return `${"#".repeat(item.level ?? 1)} `;
		case "bullet":
			return "- ";
		case "numbered":
			return "1. ";
		case "todo":
			return "- [ ] ";
		case "quote":
			return "> ";
		case "link":
		case "text":
		case "code":
			return "";
	}
}

function getLineFormatLabel(doc: EditorView["state"]["doc"], lineNumber: number): string {
	const lineText = doc.line(lineNumber).text;
	const content = lineText.slice(lineText.match(/^([ \t]*)/)?.[0].length ?? 0);

	const headingMatch = content.match(/^(#{1,6})(?:[ \t]+|$)/);
	if (headingMatch) {
		return `H${(headingMatch[1] ?? "#").length}`;
	}

	if (isLineInsideFencedCodeBlock(doc, lineNumber)) {
		return "代码";
	}

	if (/^[-*+][ \t]+\[[ xX]\][ \t]+/.test(content)) {
		return "待办";
	}

	if (/^[-*+][ \t]+/.test(content)) {
		return "无序";
	}

	if (/^\d+[.)][ \t]+/.test(content)) {
		return "有序";
	}

	if (/^>[ \t]+/.test(content)) {
		return "引用";
	}

	return "T";
}

function isLineInsideFencedCodeBlock(doc: EditorView["state"]["doc"], lineNumber: number): boolean {
	let insideFence = false;

	for (let currentLineNumber = 1; currentLineNumber <= lineNumber; currentLineNumber += 1) {
		const text = doc.line(currentLineNumber).text.trimStart();
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

function stripMarkdownBlockMarker(lineText: string): { indent: string; content: string } {
	const indentMatch = lineText.match(/^([ \t]*)/);
	const indent = indentMatch?.[1] ?? "";
	let content = lineText.slice(indent.length);

	content = content.replace(/^#{1,6}[ \t]+/, "");
	content = content.replace(/^[-*+][ \t]+\[[ xX]\][ \t]+/, "");
	content = content.replace(/^[-*+][ \t]+/, "");
	content = content.replace(/^\d+[.)][ \t]+/, "");
	content = content.replace(/^>[ \t]+/, "");
	content = content.replace(/^```[^\n]*$/, "");

	return { indent, content };
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
