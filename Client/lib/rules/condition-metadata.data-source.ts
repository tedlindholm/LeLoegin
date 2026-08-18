import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import { toConditionMetadata } from '../models/api-adapters.js';
import type { ConditionMetadata } from '../rules/rule-condition.js';

/**
 * Data source for the Le Løgin condition metadata endpoint.
 * Fetches the server-authoritative list of fields, their valid operators,
 * default values, and allowed values for the condition editor.
 */
export class LeLøginScreenConditionMetadataDataSource extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}

	async getConditionMetadata(): Promise<{ data: ConditionMetadata | undefined; error: unknown }> {
		const { data, error } = await tryExecute(
			this,
			V1.getRulesConditionMetadata()
		);

		return {
			data: data === undefined ? undefined : toConditionMetadata(data),
			error
		};
	}
}
