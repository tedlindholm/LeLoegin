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
	LeLøginScreenRuntimeResolver runtimeResolver,
	ILogger<RuleController> logger,
	IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : ApiControllerBase
{
	/// <summary>Matches the length of the <c>Name</c> column.</summary>
	private const int MaxNameLength = 255;

	/// <summary>Gap between consecutive rule priorities, matching the client's reorder.</summary>
	private const int PriorityStep = 100;

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
		// Same order as the runtime resolver, so the list shows which rule wins a tie.
		var rules = (await store.GetAllRulesAsync())
			.OrderBy(rule => rule.Priority)
			.ThenBy(rule => rule.Id, StringComparer.Ordinal)
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

		// A new rule goes after every existing one; reordering the list sets explicit priorities.
		var existingRules = await store.GetAllRulesAsync();
		rule.Priority = existingRules.Count == 0 ? PriorityStep : existingRules.Max(existing => existing.Priority) + PriorityStep;

		await store.UpsertRuleAsync(rule);
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

		// Preview is deterministic — it shows the rule's first image (a random rule may have several).
		var previewAssetId = rule.AssetIds.Count > 0 ? rule.AssetIds[0] : null;
		var asset = previewAssetId is null ? null : await store.GetAssetAsync(previewAssetId);
		if (asset is null || asset.Kind != LoginImageAssetKind.Background)
		{
			logger.LogDebug("Rule {RuleId} references missing or non-background asset {AssetId}", id, previewAssetId);
			return NoContent();
		}

		try
		{
			// Keep every image an enabled rule can show, so previewing a draft rule's image
			// never removes the live login image.
			var backgroundAssets = (await store.GetAllAssetsAsync())
				.Where(candidate => candidate.Kind == LoginImageAssetKind.Background);
			var assetsToKeepPublished = runtimeResolver.GetResolvableAssets(
				backgroundAssets,
				await store.GetAllRulesAsync());
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(asset, assetsToKeepPublished);
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
		else if (request.Name.Trim().Length > MaxNameLength)
			ModelState.AddModelError(nameof(request.Name), $"Rule name must be at most {MaxNameLength} characters.");

		var assetIds = (request.AssetIds ?? [])
			.Select(id => id?.Trim() ?? string.Empty)
			.Where(id => id.Length > 0)
			.Distinct(StringComparer.OrdinalIgnoreCase)
			.ToList();

		if (assetIds.Count == 0)
		{
			ModelState.AddModelError(nameof(request.AssetIds), "Rule asset is required.");
		}
		else
		{
			// Only background images can be shown by a rule; logos are attached to a background.
			var backgroundAssetIds = (await store.GetAllAssetsAsync())
				.Where(a => a.Kind == LoginImageAssetKind.Background)
				.Select(a => a.Id)
				.ToHashSet(StringComparer.OrdinalIgnoreCase);
			if (assetIds.Any(id => !backgroundAssetIds.Contains(id)))
				ModelState.AddModelError(nameof(request.AssetIds), "Rule images must be existing background images.");
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
			// Ids are always generated here, so a create can never overwrite another rule.
			Id = existingId ?? Guid.NewGuid().ToString("N"),
			Name = request.Name?.Trim() ?? string.Empty,
			Priority = request.Priority,
			Enabled = request.Enabled,
			Condition = condition,
			AssetIds = assetIds,
		};
	}

	private bool TryMapRule(LoginRule rule, out LoginRuleResponseModel? mapped)
	{
		mapped = null;

		try
		{
			var condition = LoginRuleConditionJsonMapper.ToConditionGroupModel(rule.Condition, $"{rule.Id}-condition");
			mapped = new LoginRuleResponseModel(rule.Id, rule.Name, rule.Priority, rule.Enabled, condition, rule.AssetIds);
			return true;
		}
		catch (InvalidOperationException exception)
		{
			logger.LogWarning(exception, "Skipping invalid stored rule {RuleId} due to condition mapping failure.", rule.Id);
			return false;
		}
	}
}
