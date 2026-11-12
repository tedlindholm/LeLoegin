/**
 * Tells an async load whether it is still the most recent one, so a response that arrives
 * after a newer load started can be ignored instead of overwriting newer state.
 */
export class LatestLoad {
	#latest = 0;

	/**
	 * Starts a load and supersedes any earlier one.
	 *
	 * @returns A check that is `true` while this load is the most recent one.
	 */
	begin(): () => boolean {
		const load = ++this.#latest;
		return () => load === this.#latest;
	}
}
