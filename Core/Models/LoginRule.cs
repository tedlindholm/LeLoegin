namespace LeLøgin.Core.Models;

/// <summary>
/// A login screen rule. Evaluated in priority order; first matching rule wins. When the matching
/// rule references more than one image, one of <see cref="AssetIds"/> is shown at random.
/// </summary>
public sealed class LoginRule
{
	public required string Id { get; set; }
	public required string Name { get; set; }
	public bool Enabled { get; set; } = true;
	public int Priority { get; set; }

	/// <summary>
	/// A JsonLogic condition expression, stored as raw JSON. Use <c>"true"</c> for an always-match
	/// fallback — this is how a <c>random</c> rule (no date conditions, multiple images) is stored.
	/// Kept as a raw JSON string because it is persisted as text in the <c>LeLoginRules.Condition</c> column.
	/// </summary>
	public required string Condition { get; set; }

	/// <summary>
	/// The image(s) this rule can show. <c>all</c>/<c>any</c> rules hold exactly one; a <c>random</c>
	/// rule holds one or more, and the resolver picks one at random each time the rule matches.
	/// </summary>
	public required IReadOnlyList<string> AssetIds { get; set; }
}
