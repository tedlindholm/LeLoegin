import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import { mapApiActiveLeLøginScreenResponse } from '../models/api-adapters.js';

/** Data source for the resolved login screen: the live `runtime/active` result and per-rule previews. */
export class LeLøginScreenActiveScreenDataSource extends UmbControllerBase {
	/**
	 * Creates the data source; API calls run through `tryExecute` against this controller.
	 *
	 * @param host - The controller host that owns this data source
	 */
	constructor(host: UmbControllerHost) {
		super(host);
	}

	/**
	 * Fetches the screen the login page would currently show, bypassing HTTP caches.
	 *
	 * @returns The mapped screen; `data: null` when no rule matches (204); or an error, including
	 * a mapping failure on a malformed response
	 */
	async getActive() {
		const { data, error } = await tryExecute(
			this,
			V1.getRuntimeActive({ headers: { 'Cache-Control': 'no-cache' } })
		);
		return this.#mapResponse(data, error);
	}

	/**
	 * Resolves the screen for a specific rule, bypassing context matching. Used by the
	 * Overview picker to preview each rule's screen on demand.
	 *
	 * @param ruleId - The rule to resolve
	 * @returns The mapped screen; `data: null` when the rule resolves to nothing; or an error,
	 * including a mapping failure on a malformed response
	 */
	async getPreviewForRule(ruleId: string) {
		const { data, error } = await tryExecute(
			this,
			V1.getRulesByIdPreview({
				path: { id: ruleId },
				headers: { 'Cache-Control': 'no-cache' }
			})
		);
		return this.#mapResponse(data, error);
	}

	#mapResponse(data: unknown, error: unknown) {
		if (error) {
			return { data: undefined, error };
		}

		// 204 No Content: the generated OpenAPI client returns `null` when Content-Type is absent.
		if (data === undefined || data === null) {
			return { data: null, error: undefined };
		}

		try {
			return { data: mapApiActiveLeLøginScreenResponse(data), error: undefined };
		} catch (parseError) {
			return { data: undefined, error: parseError };
		}
	}
}
