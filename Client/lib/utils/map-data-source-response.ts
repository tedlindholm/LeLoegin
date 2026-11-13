/**
 * Maps an API response payload through `mapper` while preserving the `{ data, error }` contract:
 * any adapter exception is caught and returned as `{ data: undefined, error }`.
 *
 * @param data - Raw response data when the request succeeded.
 * @param error - Request error, if any.
 * @param mapper - Adapter function to convert the raw payload.
 * @returns Mapped `{ data, error }` result.
 */
export function mapDataSourceResponse<TRaw, TMapped, TError>(
	data: TRaw | undefined,
	error: TError | undefined,
	mapper: (raw: TRaw) => TMapped
): { data: TMapped | undefined; error: TError | Error | undefined } {
	if (error) {
		return { data: undefined, error };
	}

	if (data === undefined) {
		return { data: undefined, error: undefined };
	}

	try {
		return { data: mapper(data), error: undefined };
	} catch (mappingError) {
		return {
			data: undefined,
			error: mappingError instanceof Error ? mappingError : new Error(String(mappingError))
		};
	}
}
