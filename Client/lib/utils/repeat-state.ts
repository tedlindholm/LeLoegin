/**
 * Sets a string state so its observers hear the value even when it equals the current one.
 * A state notifies only on a change, so the value is cleared first.
 */
export const setStringStateAlways = (
	state: { setValue(value: string): void },
	value: string
): void => {
	state.setValue('');
	state.setValue(value);
};
