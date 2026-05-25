/** Shared TypeScript types matching the C# domain models. */

export type {
	ConditionFieldMetadata,
	ConditionMetadata,
	ConditionOperatorMetadata,
	LoginRuleCondition,
	LoginRuleConditionGroup,
	LoginRuleConditionGroupOperator,
	LoginRuleConditionOperator,
	LoginRuleConditionValue,
	LoginRuleField
} from '../rules/rule-condition.js';

import type { LoginRuleConditionGroup } from '../rules/rule-condition.js';

export type LoginImageAssetKind = 'background' | 'logo';

/** Normalised focal-point coordinates (0–1). Shape mirrors UmbFocalPointModel. */
export interface FocalPoint {
	left: number;
	top: number;
}

export interface LoginImageAsset {
	id: string;
	name: string;
	kind: LoginImageAssetKind;
	altText?: string;
	greetingText?: string;
	logoAssetId?: string;
	focalPoint?: FocalPoint;
	zoom?: number;
	storagePath: string;
	publicPath?: string;
	width: number;
	height: number;
	createdAt: string;
	updatedAt: string;
}

export interface LoginSettings {
	publicEndpointCacheSeconds: number;
}

export interface ActiveLeLøginScreenResponse {
	imageUrl: string;
	assetId: string;
	altText?: string;
	greetingText?: string;
	focalPoint?: FocalPoint;
	zoom?: number;
	logoAssetId?: string;
}

export interface LoginRule {
	id: string;
	name: string;
	priority: number;
	enabled: boolean;
	assetId: string;
	condition: LoginRuleConditionGroup;
}

export const isBackgroundLoginImageAsset = (
	asset: LoginImageAsset
): asset is LoginImageAsset & { kind: 'background' } => asset.kind === 'background';

export const isLogoLoginImageAsset = (
	asset: LoginImageAsset
): asset is LoginImageAsset & { kind: 'logo' } => asset.kind === 'logo';
