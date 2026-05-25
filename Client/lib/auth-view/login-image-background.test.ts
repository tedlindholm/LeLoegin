import { describe, expect, it } from 'vitest';
import { toLoginImageBackground } from './login-image-background.js';

describe('login image background', () => {
	it('builds the Umbraco login background shorthand with centring and cover sizing', () => {
		expect(toLoginImageBackground('/login-screen/runtime-image-guid.jpg')).toBe(
			'url("/login-screen/runtime-image-guid.jpg") no-repeat center center / cover'
		);
	});

	it('escapes double quotes in image URLs before writing CSS', () => {
		expect(toLoginImageBackground('/login-screen/runtime-image-"quoted".jpg')).toBe(
			'url("/login-screen/runtime-image-%22quoted%22.jpg") no-repeat center center / cover'
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
