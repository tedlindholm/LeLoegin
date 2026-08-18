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

export const mapApiLoginAssets = (assets: Array<ApiLoginImageAsset>): Array<LoginImageAsset> =>
	assets.map(mapApiLoginAsset);

export const mapApiLoginRule = (rule: LoginRuleResponseModel): LoginRule => ({
	id: rule.id,
	name: rule.name,
	priority: toDomainNumber(rule.priority, 'priority'),
	enabled: rule.enabled,
	assetIds: [...rule.assetIds],
	condition: mapApiLoginRuleConditionGroup(rule.condition)
});

export const mapApiLoginRules = (rules: Array<LoginRuleResponseModel>): Array<LoginRule> =>
	rules.map(mapApiLoginRule);

export const toSaveRuleRequest = (rule: LoginRule): SaveRuleRequest => ({
	id: rule.id,
	name: rule.name,
	priority: rule.priority,
	enabled: rule.enabled,
	assetIds: [...rule.assetIds],
	condition: toSaveRuleConditionGroup(rule.condition)
});

export const mapApiActiveLeLøginScreenResponse = (response: unknown): ActiveLeLøginScreenResponse =>
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
	if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) {
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
		!value.every((v): v is string | number => typeof v === 'string' || typeof v === 'number')
	) {
		throw new Error(`Expected ${label} to be a string/number array when present.`);
	}
	return value;
};

const parseConditionOperatorMetadata = (meta: unknown): ConditionOperatorMetadata => {
	if (!isObject(meta) || typeof meta.arity !== 'string') {
		throw new Error("Expected condition operator metadata to contain a string 'arity'.");
	}
	if (meta.arity === 'single' || meta.arity === 'set' || meta.arity === 'range') {
		return { arity: meta.arity };
	}
	throw new Error(`Le Løgin received an unsupported operator arity '${meta.arity}'.`);
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
