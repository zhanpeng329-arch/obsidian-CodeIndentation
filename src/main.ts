import { Plugin } from "obsidian";
import { registerCodeBlockIndenting } from "./code-block-indent";

export default class ListCodeBlockIndentPlugin extends Plugin {
	onload() {
		registerCodeBlockIndenting(this);
	}
}
