/**
 * Escapes characters in a URL string that could break out of a CSS `url("…")` token.
 *
 * @param value - The URL string to escape.
 * @returns The escaped URL safe for interpolation inside CSS `url("…")`.
 */
export function escapeCssUrl(value: string): string {
	return value
		.replaceAll('\\', '%5C')
		.replaceAll('"', '%22')
		.replaceAll('(', '%28')
		.replaceAll(')', '%29')
		.replaceAll('\n', '%0A')
		.replaceAll('\r', '%0D')
		.replaceAll('\f', '%0C');
}

