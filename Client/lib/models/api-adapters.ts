import type {
	AssetUpdateRequest as ApiAssetUpdateRequest,
	ConditionMetadataResponse as ApiConditionMetadata,
	FocalPoint as ApiFocalPoint,
	LoginImageAsset as ApiLoginImageAsset,
	LoginRuleConditionGroupModel,
	LoginRuleConditionModel,
	LoginRuleResponseModel,
	SaveRuleRequest
} from '../api/index.js';
import type {
	ActiveLeLøginScreenResponse,
	ConditionFieldMetadata,
	ConditionMetadata,
	ConditionOperatorMetadata,
	FocalPoint,
	LoginImageAsset,
	LoginRule,
	LoginRuleCondition,
	LoginRuleConditionGroup,
	LoginRuleConditionOperator,
	LoginRuleField
} from './index.js';
import { ensureConditionField, ensureConditionOperator } from './api-rule-contract.js';

/** Request body for an asset update, as the generated client expects it. */
export type ApiAssetUpdateBody = ApiAssetUpdateRequest;

const normaliseNullable = <T>(value: T | null | undefined): T | undefined => value ?? undefined;
const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// The server's JSON options allow reading numbers from strings, so the contract types
// integers as ["integer", "string"]. The server always writes numbers; coerce the string
// alternative here so the domain stays numeric, and throw on anything non-numeric so a
// corrupted payload cannot poison the editor.
const toDomainNumber = (value: number | string, fieldName: string): number => {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (typeof value === 'string' && value.trim() === '') {
		throw new Error(`Expected '${fieldName}' to be a number.`);
	}
	if (!Number.isFinite(parsed)) {
		throw new Error(`Expected '${fieldName}' to be a number.`);
	}
	return parsed;
};

const mapApiLoginRuleConditionGroup = (
	conditionGroup: LoginRuleConditionGroupModel
): LoginRuleConditionGroup => ({
	operator: conditionGroup.operator,
	conditions: conditionGroup.conditions.map(mapApiLoginRuleCondition)
});

const mapApiLoginRuleCondition = (condition: LoginRuleConditionModel): LoginRuleCondition => ({
	id: condition.id,
	field: condition.field,
	operator: condition.operator,
	values: [...condition.values]
});

const toSaveRuleConditionGroup = (
	conditionGroup: LoginRuleConditionGroup
): LoginRuleConditionGroupModel => ({
	operator: conditionGroup.operator,
	conditions: conditionGroup.conditions.map((condition) => ({
		id: condition.id,
		field: condition.field,
		operator: condition.operator,
		values: [...condition.values]
	}))
});

const mapApiFocalPoint = (value: ApiFocalPoint | null | undefined): FocalPoint | undefined => {
	if (value === null || value === undefined) return undefined;
	if (typeof value.left !== 'number' || typeof value.top !== 'number') return undefined;
	return { left: value.left, top: value.top };
};

/**
 * Maps an asset from the API contract to the domain model. Nullable fields become absent
 * properties, an invalid focal point or a zoom below 1 is dropped, and width and height are
 * coerced to numbers.
 *
 * @param asset - The asset as returned by the generated client.
 * @returns The domain asset.
 * @throws {Error} When `width` or `height` is not numeric.
 */
export const mapApiLoginAsset = (asset: ApiLoginImageAsset): LoginImageAsset => {
	const altText = normaliseNullable(asset.altText);
	const greetingText = normaliseNullable(asset.greetingText);
	const logoAssetId = normaliseNullable(asset.logoAssetId);
	const publicPath = normaliseNullable(asset.publicPath);
	const focalPoint = mapApiFocalPoint(asset.focalPoint);
	// Preserve zoom=1 from the wire so round-trips don't lose information; downstream
	// rendering and persistence both treat 1 as a no-op anyway. Non-finite values get
	// stripped so a corrupted store record can't poison the editor.
	const zoom =
		typeof asset.zoom === 'number' && Number.isFinite(asset.zoom) && asset.zoom >= 1
			? asset.zoom
			: undefined;
	return {
		id: asset.id,
		name: asset.name,
		kind: asset.kind,
		...(altText === undefined ? {} : { altText }),
		...(greetingText === undefined ? {} : { greetingText }),
		...(logoAssetId === undefined ? {} : { logoAssetId }),
		...(focalPoint === undefined ? {} : { focalPoint }),
		...(zoom === undefined ? {} : { zoom }),
		storagePath: asset.storagePath,
		...(publicPath === undefined ? {} : { publicPath }),
		width: toDomainNumber(asset.width, 'width'),
		height: toDomainNumber(asset.height, 'height'),
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt
	};
};

/**
 * Maps a list of API assets to domain assets with {@link mapApiLoginAsset}.
 *
 * @param assets - The assets as returned by the generated client.
 * @returns The domain assets, in the same order.
 * @throws {Error} When any asset has a non-numeric `width` or `height`.
 */
export const mapApiLoginAssets = (assets: Array<ApiLoginImageAsset>): Array<LoginImageAsset> =>
	assets.map(mapApiLoginAsset);

/**
 * Maps a rule from the API contract to the domain model, copying arrays so the result does not
 * share state with the response.
 *
 * @param rule - The rule as returned by the generated client.
 * @returns The domain rule.
 * @throws {Error} When `priority` is not numeric.
 */
export const mapApiLoginRule = (rule: LoginRuleResponseModel): LoginRule => ({
	id: rule.id,
	name: rule.name,
	priority: toDomainNumber(rule.priority, 'priority'),
	enabled: rule.enabled,
	assetIds: [...rule.assetIds],
	condition: mapApiLoginRuleConditionGroup(rule.condition)
});

/**
 * Maps a list of API rules to domain rules with {@link mapApiLoginRule}.
 *
 * @param rules - The rules as returned by the generated client.
 * @returns The domain rules, in the same order.
 * @throws {Error} When any rule has a non-numeric `priority`.
 */
export const mapApiLoginRules = (rules: Array<LoginRuleResponseModel>): Array<LoginRule> =>
	rules.map(mapApiLoginRule);

/**
 * Builds the save request body for a domain rule, copying arrays so later edits to the rule
 * do not change the request.
 *
 * @param rule - The rule to save.
 * @returns The request body for the generated client.
 */
export const toSaveRuleRequest = (rule: LoginRule): SaveRuleRequest => ({
	id: rule.id,
	name: rule.name,
	priority: rule.priority,
	enabled: rule.enabled,
	assetIds: [...rule.assetIds],
	condition: toSaveRuleConditionGroup(rule.condition)
});

/**
 * Maps the untyped `runtime/active` response to the domain model. Alias of
 * {@link parseActiveLeLøginScreenResponse}, named to match the other `mapApi*` adapters.
 *
 * @param response - The parsed JSON body.
 * @returns The validated active login-screen configuration.
 * @throws {Error} When the response does not match the expected shape.
 */
export const mapApiActiveLeLøginScreenResponse =(response: unknown): ActiveLeLøginScreenResponse =>
	parseActiveLeLøginScreenResponse(response);

const readOptionalString = (value: unknown, fieldName: string): string | undefined => {
	if (value === null || value === undefined) return undefined;
	if (typeof value !== 'string') {
		throw new Error(`Expected '${fieldName}' to be a string when present.`);
	}
	return value;
};

const readOptionalFocalPoint = (value: unknown, fieldName: string): FocalPoint | undefined => {
	if (value === null || value === undefined) return undefined;
	if (!isObject(value) || typeof value.left !== 'number' || typeof value.top !== 'number') {
		throw new Error(
			`Expected '${fieldName}' to be an object with numeric 'left' and 'top' fields when present.`
		);
	}
	return { left: value.left, top: value.top };
};

const readOptionalZoom = (value: unknown, fieldName: string): number | undefined => {
	if (value === null || value === undefined) return undefined;
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
		throw new Error(
			`Expected '${fieldName}' to be a finite number greater than or equal to 1 when present.`
		);
	}
	return value;
};

const expectStringArray = (value: unknown, label: string): readonly string[] => {
	if (!Array.isArray(value) || !value.every((v: unknown): v is string => typeof v === 'string')) {
		throw new Error(`Expected ${label} to be a string array.`);
	}
	return value;
};

const expectStringOrNumber = (value: unknown, label: string): string | number => {
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new Error(`Expected ${label} to be a string or number.`);
	}
	return value;
};

const expectOptionalStringOrNumberArray = (
	value: unknown,
	label: string
): ReadonlyArray<string | number> | undefined => {
	if (value === null || value === undefined) return undefined;
	if (
		!Array.isArray(value) ||
		!value.every(
			(v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number'
		)
	) {
		throw new Error(`Expected ${label} to be a string/number array when present.`);
	}
	return value;
};

const parseConditionOperatorMetadata = (meta: unknown): ConditionOperatorMetadata => {
	if (!isObject(meta) || typeof meta.arity !== 'string') {
		throw new Error("Expected condition operator metadata to contain a string 'arity'.");
	}
	switch (meta.arity) {
		case 'single':
		case 'set':
		case 'range':
			return { arity: meta.arity };
		default:
			throw new Error(`Le Løgin received an unsupported operator arity '${meta.arity}'.`);
	}
};

const parseConditionFieldMetadata = (meta: unknown): ConditionFieldMetadata => {
	if (!isObject(meta)) {
		throw new Error('Expected condition field metadata to be an object.');
	}

	const operators = expectStringArray(meta.operators, "condition field metadata 'operators'");
	const defaultValue = expectStringOrNumber(
		meta.defaultValue,
		"condition field metadata 'defaultValue'"
	);
	const allowedValues = expectOptionalStringOrNumberArray(
		meta.allowedValues,
		"condition field metadata 'allowedValues'"
	);

	return {
		operators: operators.map(ensureConditionOperator),
		defaultValue,
		...(allowedValues === undefined ? {} : { allowedValues: [...allowedValues] })
	};
};

/**
 * Converts the condition-metadata response into typed maps keyed by operator and field,
 * validating every key and entry at runtime.
 *
 * @param api - The condition-metadata response from the generated client.
 * @returns Operator and field metadata as maps.
 * @throws {Error} When an operator, field, arity or field entry is unknown or malformed.
 */
export const toConditionMetadata = (api: ApiConditionMetadata): ConditionMetadata => {
	const operators = new Map<LoginRuleConditionOperator, ConditionOperatorMetadata>(
		Object.entries(api.operators).map(([op, meta]) => [
			ensureConditionOperator(op),
			parseConditionOperatorMetadata(meta)
		])
	);

	const fields = new Map<LoginRuleField, ConditionFieldMetadata>(
		Object.entries(api.fields).map(([field, meta]) => [
			ensureConditionField(field),
			parseConditionFieldMetadata(meta)
		])
	);

	return { operators, fields };
};

/**
 * Validates an untyped `runtime/active` response. `imageUrl` and `assetId` are required;
 * optional fields that are `null` or missing are left out of the result.
 *
 * @param response - The parsed JSON body.
 * @returns The validated active login-screen configuration.
 * @throws {Error} When the response is not an object, a required field is not a string, or an
 * optional field has the wrong type (including a zoom below 1).
 */
export const parseActiveLeLøginScreenResponse = (
	response: unknown
): ActiveLeLøginScreenResponse => {
	if (!isObject(response)) {
		throw new Error('Expected the active login screen response to be an object.');
	}
	if (typeof response.imageUrl !== 'string') {
		throw new Error("Expected 'imageUrl' to be a string.");
	}
	if (typeof response.assetId !== 'string') {
		throw new Error("Expected 'assetId' to be a string.");
	}

	const altText = readOptionalString(response.altText, 'altText');
	const greetingText = readOptionalString(response.greetingText, 'greetingText');
	const focalPoint = readOptionalFocalPoint(response.focalPoint, 'focalPoint');
	const zoom = readOptionalZoom(response.zoom, 'zoom');
	const logoAssetId = readOptionalString(response.logoAssetId, 'logoAssetId');

	return {
		imageUrl: response.imageUrl,
		assetId: response.assetId,
		...(altText === undefined ? {} : { altText }),
		...(greetingText === undefined ? {} : { greetingText }),
		...(focalPoint === undefined ? {} : { focalPoint }),
		...(zoom === undefined ? {} : { zoom }),
		...(logoAssetId === undefined ? {} : { logoAssetId })
	};
};
