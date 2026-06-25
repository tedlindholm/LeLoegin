/**
 * Escapes double quotes in a URL string to prevent CSS injection.
 *
 * @param value - The URL string to escape.
 * @returns The escaped URL with double quotes replaced by `%22`.
 */
const safeCssUrl = (value: string) => value.replaceAll('"', '%22');

/**
 * Builds the background shorthand expected by Umbraco's auth layout image wrapper.
 *
 * When a focal point is supplied the background position reflects it (used by the
 * in-editor preview so the chosen focal point is visualised against the uncropped
 * thumbnail). At runtime the URL is already cropped by ImageSharp.Web so callers
 * omit the focal point and `center center` shows the correct region.
 *
 * @param imageUrl - The public image URL to render on the login screen.
 * @param focalPoint - Optional normalised focal point (0–1) for in-editor previews.
 * @returns A CSS background shorthand with the chosen position and cover sizing.
 */
export const toLoginImageBackground = (
	imageUrl: string,
	focalPoint?: { left: number; top: number }
) => {
	const position =
		focalPoint === undefined
			? 'center center'
			: `${formatPositionPercent(focalPoint.left)} ${formatPositionPercent(focalPoint.top)}`;
	return `url("${safeCssUrl(imageUrl)}") no-repeat ${position} / cover`;
};

const formatPositionPercent = (value: number) => {
	const clamped = Math.min(1, Math.max(0, value));
	const percent = clamped * 100;
	// Trim trailing zeros while keeping integer percents stable (50%, not 50.0000%).
	return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(4))}%`;
};
