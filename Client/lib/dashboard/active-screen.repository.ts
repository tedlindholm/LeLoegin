import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { LeLøginScreenActiveScreenDataSource } from './active-screen.data-source.js';

export class LeLøginScreenActiveScreenRepository extends UmbRepositoryBase {
	#dataSource: LeLøginScreenActiveScreenDataSource;

	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new LeLøginScreenActiveScreenDataSource(this);
	}

	async requestActive() {
		return this.#dataSource.getActive();
	}

	async requestPreviewForRule(ruleId: string) {
		return this.#dataSource.getPreviewForRule(ruleId);
	}
}
