import { Plugin } from "obsidian";
import { registerBlockFormatMenu } from "./block-format-menu";
import { registerCodeBlockIndenting } from "./code-block-indent";
import { registerCodeBlockStyling } from "./code-block-style";
import { registerHeadingMarkerStyling } from "./heading-marker-style";

export default class ListCodeBlockIndentPlugin extends Plugin {
	onload() {
		registerBlockFormatMenu(this);
		registerCodeBlockIndenting(this);
		registerCodeBlockStyling(this);
		registerHeadingMarkerStyling(this);
	}
}
