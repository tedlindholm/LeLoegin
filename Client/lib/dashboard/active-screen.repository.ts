import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { LeLøginScreenActiveScreenDataSource } from './active-screen.data-source.js';

/** Repository for the resolved login screen shown on the Overview dashboard. */
export class LeLøginScreenActiveScreenRepository extends UmbRepositoryBase {
	#dataSource: LeLøginScreenActiveScreenDataSource;

	/**
	 * Creates the repository and its owned data source.
	 *
	 * @param host - The controller host that owns this repository
	 */
	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new LeLøginScreenActiveScreenDataSource(this);
	}

	/**
	 * Requests the screen the login page would currently show.
	 *
	 * @returns The screen, `data: null` when no rule matches, or an error
	 */
	async requestActive() {
		return this.#dataSource.getActive();
	}

	/**
	 * Requests the screen a specific rule resolves to, regardless of whether it currently matches.
	 *
	 * @param ruleId - The rule to resolve
	 * @returns The screen, `data: null` when the rule resolves to nothing, or an error
	 */
	async requestPreviewForRule(ruleId: string) {
		return this.#dataSource.getPreviewForRule(ruleId);
	}
}
