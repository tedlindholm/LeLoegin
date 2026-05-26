using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using LeLøgin.Core.Api.Runtime;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;

namespace LeLøgin.Core.Api.Rules;

/// <summary>
/// Manages login screen rules.
/// </summary>
public sealed class RuleController(
	ILeLøginScreenStore store,
	ILeLøginScreenFileService fileService,
	ILogger<RuleController> logger,
	IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
	LeLøginPackageManifestCacheInvalidator manifestCacheInvalidator,
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : ApiControllerBase
{
	[HttpGet("rules/condition-metadata")]
	[ProducesResponseType<ConditionMetadataResponse>(StatusCodes.Status200OK)]
	public IActionResult GetConditionMetadata()
	{
		var response = new ConditionMetadataResponse(
			Operators: new Dictionary<string, ConditionOperatorMetadata>
			{
				["is"] = new("single"),
				["isNot"] = new("single"),
				["in"] = new("set"),
				["notIn"] = new("set"),
				["between"] = new("range"),
				["notBetween"] = new("range"),
			},
			Fields: new Dictionary<string, ConditionFieldMetadata>
			{
				["weekday"] = new(
					Operators: ["is", "isNot"],
					DefaultValue: "monday",
					AllowedValues: new object[] { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" }
				),
				["month"] = new(
					Operators: ["is", "isNot"],
					DefaultValue: 1,
					AllowedValues: new object[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 }
				),
			});

		return Ok(response);
	}

	[HttpGet("rules")]
	[ProducesResponseType<IEnumerable<LoginRuleResponseModel>>(StatusCodes.Status200OK)]
	public async Task<IActionResult> GetAll()
	{
		var rules = (await store.GetAllRulesAsync())
			.OrderBy(rule => rule.Priority)
			.Select(rule => TryMapRule(rule, out var mapped) ? mapped : null)
			.OfType<LoginRuleResponseModel>()
			.ToList();
		return Ok(rules);
	}

	[HttpGet("rules/{id}")]
	[ProducesResponseType<LoginRuleResponseModel>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Get(string id)
	{
		var rule = await store.GetRuleAsync(id);
		if (rule is null) return NotFound();

		return TryMapRule(rule, out var mapped)
			? Ok(mapped)
			: NotFound();
	}

	[HttpPost("rules")]
	[ProducesResponseType<LoginRuleResponseModel>(StatusCodes.Status201Created)]
	[ProducesResponseType(StatusCodes.Status400BadRequest)]
	public async Task<IActionResult> Create([FromBody] SaveRuleRequest request)
	{
		var rule = await MapRequestAsync(request);
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		await store.UpsertRuleAsync(rule);
		manifestCacheInvalidator.Invalidate();
		if (!TryMapRule(rule, out var mapped))
		{
			logger.LogError("Failed to map newly created rule {RuleId} to response model.", rule.Id);
			return Problem("Rule was created but could not be mapped to a response model.");
		}

		return CreatedAtAction(nameof(Get), new { id = rule.Id }, mapped);
	}

	[HttpPut("rules/{id}")]
	[ProducesResponseType<LoginRuleResponseModel>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status400BadRequest)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Update(string id, [FromBody] SaveRuleRequest request)
	{
		var existing = await store.GetRuleAsync(id);
		if (existing is null) return NotFound();

		var rule = await MapRequestAsync(request, id);
		if (!ModelState.IsValid) return ValidationProblem(ModelState);

		await store.UpsertRuleAsync(rule);
		manifestCacheInvalidator.Invalidate();

		if (!TryMapRule(rule, out var mapped))
		{
			logger.LogError("Failed to map updated rule {RuleId} to response model.", id);
			return Problem("Rule was updated but could not be mapped to a response model.");
		}

		return Ok(mapped);
	}

	[HttpDelete("rules/{id}")]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Delete(string id)
	{
		var existing = await store.GetRuleAsync(id);
		if (existing is null) return NotFound();

		await store.DeleteRuleAsync(id);
		manifestCacheInvalidator.Invalidate();
		return NoContent();
	}

	/// <summary>
	/// Returns the resolved screen for a specific rule — bypassing context matching so the
	/// backoffice picker can preview each rule's screen on demand. Auth-protected (inherited
	/// from <see cref="ApiControllerBase"/>) because it lets callers enumerate rule IDs and
	/// resolve their image URLs.
	/// </summary>
	[HttpGet("rules/{id}/preview")]
	[ProducesResponseType<ActiveLeLøginScreenResponse>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Preview(string id)
	{
		var rule = await store.GetRuleAsync(id);
		if (rule is null) return NotFound();

		var asset = await store.GetAssetAsync(rule.AssetId);
		if (asset is null || asset.Kind != LoginImageAssetKind.Background)
		{
			logger.LogDebug("Rule {RuleId} references missing or non-background asset {AssetId}", id, rule.AssetId);
			return NoContent();
		}

		try
		{
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(asset);
			var imageUrl = LoginScreenImageUrlBuilder.ApplyImageProcessing(
				runtimeAssets.ImageUrl, asset.FocalPoint, asset.Zoom,
				imageSharpOptions.Value, requestAuthorizationUtilities, logger);

			return Ok(new ActiveLeLøginScreenResponse(
				asset.Id,
				imageUrl,
				asset.AltText,
				asset.GreetingText,
				asset.FocalPoint,
				asset.Zoom,
				asset.LogoAssetId));
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to publish preview assets for rule {RuleId} (asset {AssetId})", id, asset.Id);
			return NoContent();
		}
	}

	private async Task<LoginRule> MapRequestAsync(SaveRuleRequest request, string? existingId = null)
	{
		if (string.IsNullOrWhiteSpace(request.Name))
			ModelState.AddModelError(nameof(request.Name), "Rule name is required.");

		if (string.IsNullOrWhiteSpace(request.AssetId))
		{
			ModelState.AddModelError(nameof(request.AssetId), "Rule asset is required.");
		}
		else
		{
			var validAssetIds = (await store.GetAllAssetsAsync())
				.Select(a => a.Id)
				.ToHashSet(StringComparer.OrdinalIgnoreCase);
			if (!validAssetIds.Contains(request.AssetId.Trim()))
				ModelState.AddModelError(nameof(request.AssetId), "Rule asset could not be found.");
		}

		string condition;
		try
		{
			var conditionElement = LoginRuleConditionJsonMapper.ToJsonElement(request.Condition);
			if (!LoginRuleConditionEvaluator.IsSupportedCondition(conditionElement))
				ModelState.AddModelError(nameof(request.Condition), "Rule condition is not supported.");
			condition = conditionElement.GetRawText();
		}
		catch (InvalidOperationException ex)
		{
			ModelState.AddModelError(nameof(request.Condition), ex.Message);
			condition = string.Empty;
		}

		return new LoginRule
		{
			Id = existingId ?? (string.IsNullOrWhiteSpace(request.Id) ? Guid.NewGuid().ToString("N") : request.Id.Trim()),
			Name = request.Name?.Trim() ?? string.Empty,
			Priority = request.Priority,
			Enabled = request.Enabled,
			Condition = condition,
			AssetId = request.AssetId?.Trim() ?? string.Empty,
		};
	}

	private bool TryMapRule(LoginRule rule, out LoginRuleResponseModel? mapped)
	{
		mapped = null;

		try
		{
			var condition = LoginRuleConditionJsonMapper.ToConditionGroupModel(rule.Condition, $"{rule.Id}-condition");
			mapped = new LoginRuleResponseModel(rule.Id, rule.Name, rule.Priority, rule.Enabled, condition, rule.AssetId);
			return true;
		}
		catch (InvalidOperationException exception)
		{
			logger.LogWarning(exception, "Skipping invalid stored rule {RuleId} due to condition mapping failure.", rule.Id);
			return false;
		}
	}
}
