import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import { mapApiActiveLeLøginScreenResponse } from '../models/api-adapters.js';

export class LeLøginScreenActiveScreenDataSource extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}

	async getActive() {
		const { data, error } = await tryExecute(
			this,
			V1.getRuntimeActive({ headers: { 'Cache-Control': 'no-cache' } })
		);

		if (error) {
			return { data: undefined, error };
		}

		if (data === undefined) {
			// 204 No Content — no active image configured
			return { data: null, error: undefined };
		}

		try {
			return { data: mapApiActiveLeLøginScreenResponse(data), error: undefined };
		} catch (parseError) {
			return { data: undefined, error: parseError };
		}
	}

	/**
	 * Resolves the screen for a specific rule, bypassing context matching. Used by the
	 * Overview picker to preview each rule's screen on demand.
	 */
	async getPreviewForRule(ruleId: string) {
		const { data, error } = await tryExecute(
			this,
			V1.getRulesByIdPreview({
				path: { id: ruleId },
				headers: { 'Cache-Control': 'no-cache' }
			})
		);

		if (error) {
			return { data: undefined, error };
		}

		if (data === undefined) {
			return { data: null, error: undefined };
		}

		try {
			return { data: mapApiActiveLeLøginScreenResponse(data), error: undefined };
		} catch (parseError) {
			return { data: undefined, error: parseError };
		}
	}
}
