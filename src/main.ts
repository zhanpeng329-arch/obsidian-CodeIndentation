import { Plugin } from "obsidian";
import { MarkdownFormatToolbar } from "./format-toolbar";

export default class IgnoreMDPlugin extends Plugin {
	onload(): void {
		this.addChild(new MarkdownFormatToolbar(this));
	}
}
