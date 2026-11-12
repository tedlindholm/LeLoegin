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

/** What an asset is used for on the login screen: the background image or the logo. */
export type LoginImageAssetKind = 'background' | 'logo';

/** Normalised focal-point coordinates (0–1). Shape mirrors UmbFocalPointModel. */
export interface FocalPoint {
	/** Horizontal position, 0 (left edge) to 1 (right edge). */
	left: number;
	/** Vertical position, 0 (top edge) to 1 (bottom edge). */
	top: number;
}

/** An uploaded login-screen image and its presentation settings. */
export interface LoginImageAsset {
	/** Asset identifier (GUID). */
	id: string;
	/** Display name in the backoffice. */
	name: string;
	/** Whether the asset is a background or a logo. */
	kind: LoginImageAssetKind;
	/** Alternative text for the image. */
	altText?: string;
	/** Greeting shown on the login screen alongside this background. */
	greetingText?: string;
	/** Logo asset shown with this background, if any. */
	logoAssetId?: string;
	/** Point to keep in view when the image is cropped. */
	focalPoint?: FocalPoint;
	/** Zoom factor, 1 or greater; absent means no zoom. */
	zoom?: number;
	/** Location of the source file in package-owned storage. */
	storagePath: string;
	/** Public URL of the published copy, when one exists. */
	publicPath?: string;
	/** Image width in pixels. */
	width: number;
	/** Image height in pixels. */
	height: number;
	/** Creation timestamp (ISO 8601). */
	createdAt: string;
	/** Last-update timestamp (ISO 8601). */
	updatedAt: string;
}

/** The login-screen configuration currently resolved by the public `runtime/active` endpoint. */
export interface ActiveLeLøginScreenResponse {
	/** URL of the resolved background image. */
	imageUrl: string;
	/** Identifier of the resolved background asset. */
	assetId: string;
	/** Alternative text for the image. */
	altText?: string;
	/** Greeting configured for the image. */
	greetingText?: string;
	/** Point to keep in view when the image is cropped. */
	focalPoint?: FocalPoint;
	/** Zoom factor, 1 or greater. */
	zoom?: number;
	/** Logo asset shown with the image, if any. */
	logoAssetId?: string;
}

/** A prioritised rule that decides which image the login screen shows and when. */
export interface LoginRule {
	/** Rule identifier (GUID). */
	id: string;
	/** Display name in the backoffice. */
	name: string;
	/** Evaluation order: lower values are tried first and the first matching enabled rule wins; ties fall back to id order. */
	priority: number;
	/** Whether the rule takes part in resolution. */
	enabled: boolean;
	/** Image(s) the rule can show. all/any rules hold one; a random rule holds one or more. */
	assetIds: string[];
	/** The conditions that must hold for the rule to match. */
	condition: LoginRuleConditionGroup;
}

/**
 * Type guard for background assets.
 *
 * @param asset - The asset to test.
 * @returns `true` when the asset is a background image.
 */
export const isBackgroundLoginImageAsset = (
	asset: LoginImageAsset
): asset is LoginImageAsset & { kind: 'background' } => asset.kind === 'background';

/**
 * Type guard for logo assets.
 *
 * @param asset - The asset to test.
 * @returns `true` when the asset is a logo.
 */
export const isLogoLoginImageAsset = (
	asset: LoginImageAsset
): asset is LoginImageAsset & { kind: 'logo' } => asset.kind === 'logo';
