import { Plugin } from "obsidian";

const ENHANCED_CODE_BLOCK = "lcbi-code-block";

export function registerCodeBlockStyling(plugin: Plugin): void {
	plugin.registerMarkdownPostProcessor((el) => {
		for (const codeEl of Array.from(el.querySelectorAll("pre > code"))) {
			const preEl = codeEl.parentElement;
			if (!(preEl instanceof HTMLPreElement) || preEl.closest(`.${ENHANCED_CODE_BLOCK}`)) {
				continue;
			}

			enhanceCodeBlock(preEl, codeEl.textContent ?? "");
		}
	});
}

function enhanceCodeBlock(preEl: HTMLPreElement, codeText: string): void {
	const parentEl = preEl.parentElement;
	if (!parentEl) {
		return;
	}

	const wrapperEl = document.createElement("div");
	wrapperEl.addClass(ENHANCED_CODE_BLOCK);

	const titleEl = document.createElement("div");
	titleEl.addClass("lcbi-code-title");
	titleEl.setText("代码块");
	wrapperEl.appendChild(titleEl);

	const bodyEl = document.createElement("div");
	bodyEl.addClass("lcbi-code-body");
	wrapperEl.appendChild(bodyEl);

	const lineNumbersEl = document.createElement("div");
	lineNumbersEl.addClass("lcbi-line-numbers");
	lineNumbersEl.setAttr("aria-hidden", "true");

	for (let lineNumber = 1; lineNumber <= countCodeLines(codeText); lineNumber += 1) {
		const lineNumberEl = document.createElement("span");
		lineNumberEl.setText(String(lineNumber));
		lineNumbersEl.appendChild(lineNumberEl);
	}

	parentEl.insertBefore(wrapperEl, preEl);
	bodyEl.appendChild(lineNumbersEl);
	bodyEl.appendChild(preEl);
	preEl.addClass("lcbi-enhanced-pre");
}

function countCodeLines(codeText: string): number {
	if (!codeText) {
		return 1;
	}

	const withoutTrailingLineBreak = codeText.replace(/\n$/, "");
	return Math.max(1, withoutTrailingLineBreak.split("\n").length);
}
