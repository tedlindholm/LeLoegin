import { expect, it } from 'vitest';
import { AssetThumbnailUrls } from './asset-thumbnail-urls.js';

const pngBlob = () => new Blob(['png'], { type: 'image/png' });

const createHarness = (load: (assetId: string) => Promise<Blob | undefined>) => {
	const created: Array<string> = [];
	const revoked: Array<string> = [];
	let changes = 0;
	const urls = new AssetThumbnailUrls(load, () => changes++, {
		create: () => {
			const url = `blob:test/${created.length + 1}`;
			created.push(url);
			return url;
		},
		revoke: (url) => revoked.push(url)
	});
	return { urls, created, revoked, changes: () => changes };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it('loads a thumbnail once and reports when its URL is ready', async () => {
	const requested: Array<string> = [];
	const harness = createHarness(async (assetId) => {
		requested.push(assetId);
		return pngBlob();
	});

	expect(harness.urls.peek('asset-a')).toBeUndefined();
	expect(harness.urls.peek('asset-a')).toBeUndefined();
	await settle();

	expect(harness.urls.peek('asset-a')).toBe('blob:test/1');
	expect(requested).toEqual(['asset-a']);
	expect(harness.changes()).toBe(1);
});

it('does not retry or report a change when a thumbnail cannot be loaded', async () => {
	let attempts = 0;
	const harness = createHarness(async () => {
		attempts++;
		return undefined;
	});

	harness.urls.peek('asset-missing');
	await settle();
	harness.urls.peek('asset-missing');
	await settle();

	expect(harness.urls.peek('asset-missing')).toBeUndefined();
	expect(attempts).toBe(1);
	expect(harness.created).toEqual([]);
	expect(harness.changes()).toBe(0);
});

it('revokes every URL it created when disposed', async () => {
	const harness = createHarness(async () => pngBlob());
	harness.urls.peek('asset-a');
	harness.urls.peek('asset-b');
	await settle();

	harness.urls.dispose();

	expect(harness.revoked).toEqual(['blob:test/1', 'blob:test/2']);
	expect(harness.urls.peek('asset-a')).toBeUndefined();
});

it('creates no URL for a thumbnail that arrives after disposal', async () => {
	let release: (blob: Blob) => void = () => {};
	const harness = createHarness(
		() =>
			new Promise<Blob>((resolve) => {
				release = resolve;
			})
	);
	harness.urls.peek('asset-slow');

	harness.urls.dispose();
	release(pngBlob());
	await settle();

	expect(harness.created).toEqual([]);
	expect(harness.changes()).toBe(0);
});
