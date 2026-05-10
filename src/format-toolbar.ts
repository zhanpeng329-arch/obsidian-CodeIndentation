import {
	Component,
	Editor,
	MarkdownView,
	Plugin,
	setIcon,
	setTooltip,
} from "obsidian";

interface FormatAction {
	id: string;
	label: string;
	tooltip: string;
	icon?: string;
	text?: string;
	run: (editor: Editor) => void;
}

interface LineRange {
	from: number;
	to: number;
}

const HIDE_DELAY_MS = 180;
const PANEL_GAP_PX = 8;
const VIEW_EDGE_GAP_PX = 12;

export class MarkdownFormatToolbar extends Component {
	private readonly plugin: Plugin;
	private readonly triggerEl: HTMLButtonElement;
	private readonly panelEl: HTMLElement;
	private hideTimer: number | null = null;
	private animationFrame: number | null = null;
	private pointerPosition: { x: number; y: number } | null = null;
	private hoveredLineEl: HTMLElement | null = null;
	private isPointerOnEditorLine = false;
	private isPointerInToolbar = false;

	constructor(plugin: Plugin) {
		super();
		this.plugin = plugin;
		this.triggerEl = this.createTrigger();
		this.panelEl = this.createPanel();
	}

	onload(): void {
		document.body.append(this.triggerEl, this.panelEl);

		this.registerDomEvent(this.triggerEl, "mouseenter", () => {
			this.isPointerInToolbar = true;
			this.showPanel();
		});
		this.registerDomEvent(this.triggerEl, "mouseleave", () => {
			this.isPointerInToolbar = false;
			this.scheduleHideToolbar();
		});
		this.registerDomEvent(this.triggerEl, "click", (event) => {
			event.preventDefault();
			this.togglePanel();
		});

		this.registerDomEvent(this.panelEl, "mouseenter", () => {
			this.isPointerInToolbar = true;
			this.cancelHidePanel();
		});
		this.registerDomEvent(this.panelEl, "mouseleave", () => {
			this.isPointerInToolbar = false;
			this.scheduleHideToolbar();
		});

		this.registerDomEvent(document, "selectionchange", () => this.handleEditorStateChange());
		this.registerDomEvent(document, "mousemove", (event) => this.handlePointerMove(event), true);
		this.registerDomEvent(document, "mouseup", () => this.handleEditorStateChange(), true);
		this.registerDomEvent(document, "keyup", () => this.handleEditorStateChange(), true);
		this.registerDomEvent(document, "scroll", () => this.handleEditorStateChange(), true);
		this.registerDomEvent(window, "resize", () => this.scheduleSync());
		this.registerEvent(this.plugin.app.workspace.on("active-leaf-change", () => {
			this.hoveredLineEl = null;
			this.isPointerOnEditorLine = false;
			this.scheduleSync();
		}));
		this.registerEvent(this.plugin.app.workspace.on("layout-change", () => this.scheduleSync()));
		this.registerEvent(this.plugin.app.workspace.on("editor-change", () => this.handleEditorStateChange()));

		this.register(() => this.cleanup());
		this.scheduleSync();
	}

	private createTrigger(): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "ignoremd-format-trigger is-hidden";
		button.setAttribute("aria-label", "打开 Markdown 格式工具");
		setTooltip(button, "Markdown 格式");

		const labelEl = button.createSpan({ cls: "ignoremd-format-trigger-label", text: "Md" });
		labelEl.setAttribute("aria-hidden", "true");

		const handleEl = button.createSpan({ cls: "ignoremd-format-trigger-handle" });
		setIcon(handleEl, "grip-vertical");
		handleEl.setAttribute("aria-hidden", "true");

		return button;
	}

	private createPanel(): HTMLElement {
		const panelEl = document.createElement("div");
		panelEl.className = "ignoremd-format-panel is-hidden";
		panelEl.setAttribute("role", "toolbar");
		panelEl.setAttribute("aria-label", "Markdown 常用格式");

		for (const action of this.createActions()) {
			const button = panelEl.createEl("button", {
				cls: "ignoremd-format-action",
				attr: {
					type: "button",
					"aria-label": action.tooltip,
				},
			});
			button.dataset.formatAction = action.id;
			setTooltip(button, action.tooltip);

			if (action.icon) {
				setIcon(button, action.icon);
			} else {
				button.createSpan({ cls: "ignoremd-format-action-text", text: action.text ?? action.label });
			}

			this.registerDomEvent(button, "click", (event) => {
				event.preventDefault();
				this.runAction(action);
			});
			this.registerDomEvent(button, "mousedown", (event) => {
				event.preventDefault();
			});
		}

		return panelEl;
	}

	private createActions(): FormatAction[] {
		return [
			{
				id: "heading-1",
				label: "H1",
				text: "H1",
				tooltip: "一级标题",
				run: (editor) => applyHeading(editor, 1),
			},
			{
				id: "heading-2",
				label: "H2",
				text: "H2",
				tooltip: "二级标题",
				run: (editor) => applyHeading(editor, 2),
			},
			{
				id: "heading-3",
				label: "H3",
				text: "H3",
				tooltip: "三级标题",
				run: (editor) => applyHeading(editor, 3),
			},
			{
				id: "bold",
				label: "B",
				text: "B",
				tooltip: "加粗",
				run: (editor) => wrapSelection(editor, "**", "**", "加粗文本"),
			},
			{
				id: "italic",
				label: "I",
				text: "I",
				tooltip: "斜体",
				run: (editor) => wrapSelection(editor, "*", "*", "斜体文本"),
			},
			{
				id: "highlight",
				label: "高",
				text: "高",
				tooltip: "高亮",
				run: (editor) => wrapSelection(editor, "==", "==", "高亮文本"),
			},
			{
				id: "quote",
				label: "引用",
				icon: "quote",
				tooltip: "引用",
				run: (editor) => toggleLinePrefix(editor, "> ", /^(\s*)>\s?/),
			},
			{
				id: "unordered-list",
				label: "列表",
				icon: "list",
				tooltip: "无序列表",
				run: (editor) => toggleLinePrefix(editor, "- ", /^(\s*)[-*+]\s+/),
			},
			{
				id: "ordered-list",
				label: "编号",
				icon: "list-ordered",
				tooltip: "有序列表",
				run: (editor) => toggleLinePrefix(editor, "1. ", /^(\s*)\d+[.)]\s+/),
			},
			{
				id: "task-list",
				label: "任务",
				icon: "list-checks",
				tooltip: "任务列表",
				run: applyTaskList,
			},
			{
				id: "inline-code",
				label: "代码",
				icon: "code-2",
				tooltip: "行内代码",
				run: (editor) => wrapSelection(editor, "`", "`", "code"),
			},
			{
				id: "code-block",
				label: "代码块",
				icon: "file-code-2",
				tooltip: "代码块",
				run: applyCodeBlock,
			},
			{
				id: "link",
				label: "链接",
				icon: "link",
				tooltip: "链接",
				run: applyLink,
			},
		];
	}

	private runAction(action: FormatAction): void {
		const view = this.getActiveMarkdownView();
		if (!view) {
			this.hideToolbar();
			return;
		}

		view.editor.focus();
		action.run(view.editor);
		view.editor.focus();
		this.hidePanel();
		this.scheduleSync();
	}

	private togglePanel(): void {
		if (this.panelEl.hasClass("is-hidden")) {
			this.showPanel();
			return;
		}

		this.hidePanel();
	}

	private showPanel(): void {
		if (!this.getActiveMarkdownView()) {
			this.hideToolbar();
			return;
		}

		this.cancelHidePanel();
		this.panelEl.removeClass("is-hidden");
		this.triggerEl.addClass("is-active");
		this.positionPanel();
	}

	private scheduleHidePanel(): void {
		this.cancelHidePanel();
		this.hideTimer = window.setTimeout(() => this.hidePanel(), HIDE_DELAY_MS);
	}

	private cancelHidePanel(): void {
		if (this.hideTimer === null) {
			return;
		}

		window.clearTimeout(this.hideTimer);
		this.hideTimer = null;
	}

	private hidePanel(): void {
		this.cancelHidePanel();
		this.panelEl.addClass("is-hidden");
		this.triggerEl.removeClass("is-active");
	}

	private scheduleHideToolbar(): void {
		this.cancelHidePanel();
		this.hideTimer = window.setTimeout(() => {
			if (this.isPointerOnEditorLine || this.isPointerInToolbar) {
				this.hidePanel();
				return;
			}

			this.hideToolbar();
		}, HIDE_DELAY_MS);
	}

	private handleEditorStateChange(): void {
		this.refreshPointerLineState();
		this.scheduleSync();
	}

	private handlePointerMove(event: MouseEvent): void {
		this.pointerPosition = { x: event.clientX, y: event.clientY };

		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}

		if (this.triggerEl.contains(target) || this.panelEl.contains(target)) {
			return;
		}

		const view = this.getActiveMarkdownView();
		const hoveredLineEl = view ? this.getLineFromPointer(view, event) : null;
		const isPointerOnEditorLine = hoveredLineEl !== null;
		if (isPointerOnEditorLine === this.isPointerOnEditorLine && hoveredLineEl === this.hoveredLineEl) {
			if (isPointerOnEditorLine) {
				this.scheduleSync();
			}
			return;
		}

		this.hoveredLineEl = hoveredLineEl;
		this.isPointerOnEditorLine = isPointerOnEditorLine;
		if (isPointerOnEditorLine) {
			this.cancelHidePanel();
			this.scheduleSync();
			return;
		}

		this.scheduleHideToolbar();
	}

	private scheduleSync(): void {
		if (this.animationFrame !== null) {
			return;
		}

		this.animationFrame = window.requestAnimationFrame(() => {
			this.animationFrame = null;
			this.sync();
		});
	}

	private sync(): void {
		const view = this.getActiveMarkdownView();
		if (!view || (!this.isPointerOnEditorLine && !this.isPointerInToolbar)) {
			this.hideToolbar();
			return;
		}

		this.showToolbar(view);
	}

	private showToolbar(view: MarkdownView): void {
		const lineRect = this.getHoveredLineRect(view);
		const contentRect = this.getEditorContentRect(view);
		if (!lineRect || !contentRect) {
			this.hideToolbar();
			return;
		}

		const viewRect = view.containerEl.getBoundingClientRect();
		const buttonWidth = this.triggerEl.offsetWidth || 48;
		const buttonHeight = this.triggerEl.offsetHeight || 34;
		const left = clamp(
			contentRect.left - buttonWidth - PANEL_GAP_PX,
			viewRect.left + VIEW_EDGE_GAP_PX,
			window.innerWidth - buttonWidth - VIEW_EDGE_GAP_PX,
		);
		const top = clamp(
			lineRect.top + lineRect.height / 2 - buttonHeight / 2,
			viewRect.top + VIEW_EDGE_GAP_PX,
			window.innerHeight - buttonHeight - VIEW_EDGE_GAP_PX,
		);

		this.triggerEl.style.left = `${left}px`;
		this.triggerEl.style.top = `${top}px`;
		this.triggerEl.removeClass("is-hidden");

		if (!this.panelEl.hasClass("is-hidden")) {
			this.positionPanel();
		}
	}

	private hideToolbar(): void {
		this.triggerEl.addClass("is-hidden");
		this.hidePanel();
	}

	private positionPanel(): void {
		if (this.panelEl.hasClass("is-hidden")) {
			return;
		}

		const triggerRect = this.triggerEl.getBoundingClientRect();
		const panelWidth = this.panelEl.offsetWidth || 268;
		const panelHeight = this.panelEl.offsetHeight || 94;
		let left = triggerRect.left;
		let top = triggerRect.top - panelHeight - PANEL_GAP_PX;

		if (top < VIEW_EDGE_GAP_PX) {
			top = triggerRect.bottom + PANEL_GAP_PX;
		}

		left = clamp(left, VIEW_EDGE_GAP_PX, window.innerWidth - panelWidth - VIEW_EDGE_GAP_PX);
		top = clamp(top, VIEW_EDGE_GAP_PX, window.innerHeight - panelHeight - VIEW_EDGE_GAP_PX);

		this.panelEl.style.left = `${left}px`;
		this.panelEl.style.top = `${top}px`;
	}

	private getHoveredLineRect(view: MarkdownView): DOMRect | null {
		if (this.hoveredLineEl && view.containerEl.contains(this.hoveredLineEl)) {
			return this.hoveredLineEl.getBoundingClientRect();
		}

		if (!this.pointerPosition) {
			return null;
		}

		const hoveredLineEl = this.getLineFromPointer(view, this.pointerPosition);
		this.hoveredLineEl = hoveredLineEl;
		this.isPointerOnEditorLine = hoveredLineEl !== null;

		return hoveredLineEl?.getBoundingClientRect() ?? null;
	}

	private getEditorContentRect(view: MarkdownView): DOMRect | null {
		const contentEl = view.containerEl.querySelector<HTMLElement>(".cm-content");
		if (contentEl) {
			return contentEl.getBoundingClientRect();
		}

		const editorEl = view.containerEl.querySelector<HTMLElement>(".markdown-source-view, .cm-editor");
		return editorEl?.getBoundingClientRect() ?? view.containerEl.getBoundingClientRect();
	}

	private refreshPointerLineState(): void {
		if (!this.pointerPosition) {
			return;
		}

		const view = this.getActiveMarkdownView();
		const hoveredLineEl = view ? this.getLineFromPointer(view, this.pointerPosition) : null;
		const isPointerOnEditorLine = hoveredLineEl !== null;
		if (isPointerOnEditorLine) {
			this.cancelHidePanel();
		}

		this.hoveredLineEl = hoveredLineEl;
		this.isPointerOnEditorLine = isPointerOnEditorLine;
	}

	private getLineFromPointer(view: MarkdownView, pointer: { x: number; y: number }): HTMLElement | null {
		const editorRect = this.getEditorContentRect(view);
		if (!editorRect || pointer.x < editorRect.left || pointer.x > editorRect.right) {
			return null;
		}

		const targetEl = document.elementFromPoint(pointer.x, pointer.y);
		const closestLineEl = targetEl?.closest<HTMLElement>(".cm-line") ?? null;
		if (closestLineEl && view.containerEl.contains(closestLineEl)) {
			return isCodeBlockLine(closestLineEl) ? null : closestLineEl;
		}

		for (const lineEl of Array.from(view.containerEl.querySelectorAll<HTMLElement>(".cm-line"))) {
			const lineRect = lineEl.getBoundingClientRect();
			if (pointer.y >= lineRect.top && pointer.y <= lineRect.bottom) {
				return isCodeBlockLine(lineEl) ? null : lineEl;
			}
		}

		return null;
	}

	private getActiveMarkdownView(): MarkdownView | null {
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.getMode() !== "source") {
			return null;
		}

		return view;
	}

	private cleanup(): void {
		this.cancelHidePanel();

		if (this.animationFrame !== null) {
			window.cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}

		this.triggerEl.remove();
		this.panelEl.remove();
	}
}

function wrapSelection(editor: Editor, prefix: string, suffix: string, placeholder: string): void {
	const selectedText = editor.getSelection();
	const from = editor.getCursor("from");
	const replacement = `${prefix}${selectedText || placeholder}${suffix}`;

	editor.replaceSelection(replacement, "ignoremd-format");

	if (!selectedText) {
		const startOffset = editor.posToOffset(from) + prefix.length;
		const endOffset = startOffset + placeholder.length;
		editor.setSelection(editor.offsetToPos(startOffset), editor.offsetToPos(endOffset));
	}
}

function applyHeading(editor: Editor, level: 1 | 2 | 3): void {
	const marker = `${"#".repeat(level)} `;
	const selectedText = editor.getSelection();
	const cursor = editor.getCursor("from");
	updateSelectedLines(editor, (line) => line.replace(/^(\s*)(#{1,6}\s+)?/, `$1${marker}`));

	if (!selectedText) {
		const lineText = editor.getLine(cursor.line);
		const indent = lineText.match(/^\s*/)?.[0] ?? "";
		editor.setCursor({ line: cursor.line, ch: indent.length + marker.length });
	}
}

function toggleLinePrefix(editor: Editor, prefix: string, markerPattern: RegExp): void {
	const range = getSelectedLineRange(editor);
	const lines = getLines(editor, range);
	const hasPrefixOnEveryLine = lines.every((line) => markerPattern.test(line));

	updateSelectedLines(editor, (line) => {
		if (hasPrefixOnEveryLine) {
			return line.replace(markerPattern, "$1");
		}

		return line.replace(/^(\s*)/, `$1${prefix}`);
	});
}

function applyTaskList(editor: Editor): void {
	const taskPattern = /^(\s*)[-*+]\s+\[[ xX]\]\s+/;
	const bulletPattern = /^(\s*)[-*+]\s+/;
	const range = getSelectedLineRange(editor);
	const lines = getLines(editor, range);
	const hasTaskOnEveryLine = lines.every((line) => taskPattern.test(line));

	updateSelectedLines(editor, (line) => {
		if (hasTaskOnEveryLine) {
			return line.replace(taskPattern, "$1");
		}

		if (bulletPattern.test(line)) {
			return line.replace(bulletPattern, "$1- [ ] ");
		}

		return line.replace(/^(\s*)/, "$1- [ ] ");
	});
}

function applyCodeBlock(editor: Editor): void {
	const selectedText = editor.getSelection();
	const from = editor.getCursor("from");

	if (selectedText) {
		editor.replaceSelection(`\`\`\`\n${selectedText}\n\`\`\``, "ignoremd-format");
		return;
	}

	editor.replaceSelection("```\n\n```", "ignoremd-format");
	editor.setCursor({ line: from.line + 1, ch: 0 });
}

function applyLink(editor: Editor): void {
	const selectedText = editor.getSelection();
	const label = selectedText || "链接文本";
	const from = editor.getCursor("from");
	const replacement = `[${label}](https://)`;

	editor.replaceSelection(replacement, "ignoremd-format");

	const startOffset = editor.posToOffset(from) + replacement.length - "https://".length - 1;
	const endOffset = startOffset + "https://".length;
	editor.setSelection(editor.offsetToPos(startOffset), editor.offsetToPos(endOffset));
}

function updateSelectedLines(editor: Editor, updateLine: (line: string) => string): void {
	const range = getSelectedLineRange(editor);

	for (let lineNumber = range.from; lineNumber <= range.to; lineNumber += 1) {
		editor.setLine(lineNumber, updateLine(editor.getLine(lineNumber)));
	}
}

function getLines(editor: Editor, range: LineRange): string[] {
	const lines: string[] = [];

	for (let lineNumber = range.from; lineNumber <= range.to; lineNumber += 1) {
		lines.push(editor.getLine(lineNumber));
	}

	return lines;
}

function getSelectedLineRange(editor: Editor): LineRange {
	const from = editor.getCursor("from");
	const to = editor.getCursor("to");

	return {
		from: Math.min(from.line, to.line),
		to: Math.max(from.line, to.line),
	};
}

function clamp(value: number, min: number, max: number): number {
	if (max < min) {
		return min;
	}

	return Math.min(Math.max(value, min), max);
}

function isCodeBlockLine(lineEl: HTMLElement): boolean {
	if (
		lineEl.matches(".HyperMD-codeblock, .cm-hmd-codeblock, .cm-line_HyperMD-codeblock, .HyperMD-codeblock-begin, .HyperMD-codeblock-end") ||
		lineEl.querySelector(".cm-hmd-codeblock, .cm-inline-code, .cm-formatting-code-block")
	) {
		return true;
	}

	return Boolean(lineEl.closest(".HyperMD-codeblock, .cm-hmd-codeblock, .markdown-rendered pre, .cm-preview-code-block"));
}
