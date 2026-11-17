import { describe, expect, it } from 'vitest';
import { toLoginImageBackground } from './login-image-background.js';

describe('login image background', () => {
	it('builds the Umbraco login background shorthand with centring and cover sizing', () => {
		expect(toLoginImageBackground('/login-screen/runtime-image-guid.jpg')).toBe(
			'url("/login-screen/runtime-image-guid.jpg") no-repeat center center / cover'
		);
	});

	it('escapes quotes, backslashes, parentheses, and newlines in image URLs before writing CSS (5.10)', () => {
		expect(toLoginImageBackground('/login-screen/a"b\\c(d)\ne.jpg')).toBe(
			'url("/login-screen/a%22b%5Cc%28d%29%0Ae.jpg") no-repeat center center / cover'
		);
	});

	it('positions the background using the focal point when supplied', () => {
		expect(
			toLoginImageBackground('/login-screen/runtime-image-guid.jpg', { left: 0.25, top: 0.75 })
		).toBe('url("/login-screen/runtime-image-guid.jpg") no-repeat 25% 75% / cover');
	});

	it('clamps focal point coordinates outside the 0–1 range', () => {
		expect(
			toLoginImageBackground('/login-screen/runtime-image-guid.jpg', { left: -0.5, top: 1.5 })
		).toBe('url("/login-screen/runtime-image-guid.jpg") no-repeat 0% 100% / cover');
	});
});
