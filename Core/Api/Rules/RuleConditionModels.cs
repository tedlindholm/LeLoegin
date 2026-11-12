using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace LeLøgin.Core.Api.Rules;

/// <summary>
/// Supported fields available to Le Løgin rule conditions.
/// </summary>
[JsonConverter(typeof(LoginRuleFieldJsonConverter))]
public enum LoginRuleField
{
	/// <summary>Day of the week, compared as lowercase English names (<c>monday</c>…<c>sunday</c>); serialised as <c>weekday</c>.</summary>
	Weekday,

	/// <summary>Month of the year, compared as numbers 1–12; serialised as <c>month</c>.</summary>
	Month
}

/// <summary>
/// Supported comparison operators available to a single Le Løgin rule condition.
/// </summary>
[JsonConverter(typeof(LoginRuleConditionOperatorJsonConverter))]
public enum LoginRuleConditionOperator
{
	/// <summary>The field equals the single value; serialised as <c>is</c>.</summary>
	Is,

	/// <summary>The field does not equal the single value; serialised as <c>isNot</c>.</summary>
	IsNot,

	/// <summary>The field equals one of the values; serialised as <c>in</c>.</summary>
	In,

	/// <summary>The field equals none of the values; serialised as <c>notIn</c>.</summary>
	NotIn,

	/// <summary>The field lies within the two inclusive bounds; serialised as <c>between</c>.</summary>
	Between,

	/// <summary>The field lies outside the two inclusive bounds; serialised as <c>notBetween</c>.</summary>
	NotBetween
}

/// <summary>
/// Supported group operators used to combine multiple Le Løgin rule conditions.
/// (Random image selection is independent of conditions — any matching rule with more than one
/// image shows one at random; see <see cref="LoginRuleResponseModel.AssetIds"/>.)
/// </summary>
[JsonConverter(typeof(LoginRuleConditionGroupOperatorJsonConverter))]
public enum LoginRuleConditionGroupOperator
{
	/// <summary>Every condition must match (JsonLogic <c>and</c>); serialised as <c>all</c>.</summary>
	All,

	/// <summary>At least one condition must match (JsonLogic <c>or</c>); serialised as <c>any</c>.</summary>
	Any
}

/// <summary>
/// Union-like condition value that serialises as either a string or an integer.
/// Exactly one of <see cref="Text"/> and <see cref="Number"/> is set when built through the
/// factory methods; a <see langword="default"/> instance holds neither.
/// </summary>
[JsonConverter(typeof(LoginRuleConditionValueJsonConverter))]
public readonly record struct LoginRuleConditionValue
{
	private LoginRuleConditionValue(string? text, int? number)
	{
		Text = text;
		Number = number;
	}

	/// <summary>The text value, or <see langword="null"/> when this is a number.</summary>
	public string? Text { get; }

	/// <summary>The numeric value, or <see langword="null"/> when this is text.</summary>
	public int? Number { get; }

	/// <summary>Whether the value holds text.</summary>
	public bool HasText => Text is not null;

	/// <summary>Whether the value holds a number.</summary>
	public bool HasNumber => Number.HasValue;

	/// <summary>Creates a text value.</summary>
	/// <param name="value">The text.</param>
	/// <returns>A value holding <paramref name="value"/> as text.</returns>
	public static LoginRuleConditionValue FromText(string value) => new(value, null);

	/// <summary>Creates a numeric value.</summary>
	/// <param name="value">The number.</param>
	/// <returns>A value holding <paramref name="value"/> as a number.</returns>
	public static LoginRuleConditionValue FromNumber(int value) => new(null, value);

	/// <summary>Unwraps the value for JsonLogic serialisation.</summary>
	/// <returns>The <see cref="string"/> text, or the boxed <see cref="int"/> number.</returns>
	/// <exception cref="InvalidOperationException">The value holds neither text nor a number.</exception>
	public object ToPrimitive()
	{
		var text = Text;
		if (text is not null)
		{
			return text;
		}

		var number = Number;
		if (number.HasValue)
		{
			return number.Value;
		}

		throw new InvalidOperationException("Rule condition value must be either text or a number.");
	}
}

/// <summary>
/// API model for a single editable Le Løgin rule condition.
/// </summary>
/// <param name="Id">Client-side identifier of the condition. Not stored; regenerated from the rule id when read back.</param>
/// <param name="Field">The field to compare. Must be present in JSON; a missing value is rejected rather than read as <see cref="LoginRuleField.Weekday"/>.</param>
/// <param name="Operator">How the field is compared with <paramref name="Values"/>. Must be present in JSON; a missing value is rejected rather than read as <see cref="LoginRuleConditionOperator.Is"/>.</param>
/// <param name="Values">One value for <c>is</c>/<c>isNot</c>, two bounds for <c>between</c>/<c>notBetween</c>, one or more for <c>in</c>/<c>notIn</c>. Months are numbers; weekdays are text.</param>
public sealed record LoginRuleConditionModel(
	[Required] string Id,
	[property: JsonRequired] LoginRuleField Field,
	[property: JsonRequired] LoginRuleConditionOperator Operator,
	[Required] IReadOnlyList<LoginRuleConditionValue> Values);

/// <summary>
/// API model for an editable Le Løgin rule condition group.
/// </summary>
/// <param name="Operator">Whether all or any of the conditions must match. Must be present in JSON; a missing value is rejected rather than read as <see cref="LoginRuleConditionGroupOperator.All"/>.</param>
/// <param name="Conditions">The conditions in the group.</param>
public sealed record LoginRuleConditionGroupModel(
	[property: JsonRequired] LoginRuleConditionGroupOperator Operator,
	[Required] IReadOnlyList<LoginRuleConditionModel> Conditions);

/// <summary>
/// API model returned for a stored rule.
/// </summary>
/// <param name="Id">Unique identifier of the rule.</param>
/// <param name="Name">Display name of the rule.</param>
/// <param name="Priority">Evaluation order; lower values are evaluated first.</param>
/// <param name="Enabled">Whether the rule takes part in resolution.</param>
/// <param name="Condition">The rule's conditions.</param>
/// <param name="AssetIds">Background images the rule can show; one is picked at random when there are several.</param>
public sealed record LoginRuleResponseModel(
	string Id,
	string Name,
	int Priority,
	bool Enabled,
	LoginRuleConditionGroupModel Condition,
	IReadOnlyList<string> AssetIds);

/// <summary>
/// Request payload for creating or updating a rule.
/// </summary>
public sealed class SaveRuleRequest
{
	/// <summary>Ignored: rule ids are generated by the server on create and taken from the route on update.</summary>
	public string? Id { get; init; }

	/// <summary>Display name; trimmed, required and at most 255 characters.</summary>
	[Required]
	public required string Name { get; init; }

	/// <summary>Evaluation order; applied on update and ignored on create, where the rule goes last.</summary>
	public int Priority { get; init; }

	/// <summary>Whether the rule takes part in resolution. Defaults to <see langword="true"/>.</summary>
	public bool Enabled { get; init; } = true;

	/// <summary>The rule's conditions; must be expressible as supported JsonLogic.</summary>
	[Required]
	public required LoginRuleConditionGroupModel Condition { get; init; }

	/// <summary>Ids of existing background images the rule can show; at least one. Blank and duplicate ids are dropped.</summary>
	[Required]
	public required IReadOnlyList<string> AssetIds { get; init; }
}

/// <summary>
/// Serialises <see cref="LoginRuleField"/> using the lowercase public contract values.
/// </summary>
public sealed class LoginRuleFieldJsonConverter : JsonConverter<LoginRuleField>
{
	/// <inheritdoc />
	/// <exception cref="JsonException">The value is not <c>weekday</c> or <c>month</c> (case-insensitive).</exception>
	public override LoginRuleField Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		var value = reader.GetString();
		return value?.ToLowerInvariant() switch
		{
			"weekday" => LoginRuleField.Weekday,
			"month" => LoginRuleField.Month,
			_ => throw new JsonException($"Unsupported login rule field '{value}'.")
		};
	}

	/// <inheritdoc />
	/// <exception cref="JsonException"><paramref name="value"/> is not a defined field.</exception>
	public override void Write(Utf8JsonWriter writer, LoginRuleField value, JsonSerializerOptions options)
	{
		writer.WriteStringValue(value switch
		{
			LoginRuleField.Weekday => "weekday",
			LoginRuleField.Month => "month",
			_ => throw new JsonException($"Unsupported login rule field '{value}'.")
		});
	}
}

/// <summary>
/// Serialises <see cref="LoginRuleConditionOperator"/> using the public contract values.
/// </summary>
public sealed class LoginRuleConditionOperatorJsonConverter : JsonConverter<LoginRuleConditionOperator>
{
	/// <inheritdoc />
	/// <exception cref="JsonException">The value is not a supported operator in camelCase or PascalCase.</exception>
	public override LoginRuleConditionOperator Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		var value = reader.GetString();
		return value switch
		{
			"is" or "Is" => LoginRuleConditionOperator.Is,
			"isNot" or "IsNot" => LoginRuleConditionOperator.IsNot,
			"in" or "In" => LoginRuleConditionOperator.In,
			"notIn" or "NotIn" => LoginRuleConditionOperator.NotIn,
			"between" or "Between" => LoginRuleConditionOperator.Between,
			"notBetween" or "NotBetween" => LoginRuleConditionOperator.NotBetween,
			_ => throw new JsonException($"Unsupported login rule operator '{value}'.")
		};
	}

	/// <inheritdoc />
	/// <exception cref="JsonException"><paramref name="value"/> is not a defined operator.</exception>
	public override void Write(Utf8JsonWriter writer, LoginRuleConditionOperator value, JsonSerializerOptions options)
	{
		writer.WriteStringValue(value switch
		{
			LoginRuleConditionOperator.Is => "is",
			LoginRuleConditionOperator.IsNot => "isNot",
			LoginRuleConditionOperator.In => "in",
			LoginRuleConditionOperator.NotIn => "notIn",
			LoginRuleConditionOperator.Between => "between",
			LoginRuleConditionOperator.NotBetween => "notBetween",
			_ => throw new JsonException($"Unsupported login rule operator '{value}'.")
		});
	}
}

/// <summary>
/// Serialises <see cref="LoginRuleConditionGroupOperator"/> using the public contract values.
/// </summary>
public sealed class LoginRuleConditionGroupOperatorJsonConverter : JsonConverter<LoginRuleConditionGroupOperator>
{
	/// <inheritdoc />
	/// <exception cref="JsonException">The value is not <c>all</c> or <c>any</c> (case-insensitive).</exception>
	public override LoginRuleConditionGroupOperator Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		var value = reader.GetString();
		return value?.ToLowerInvariant() switch
		{
			"all" => LoginRuleConditionGroupOperator.All,
			"any" => LoginRuleConditionGroupOperator.Any,
			_ => throw new JsonException($"Unsupported login rule group operator '{value}'.")
		};
	}

	/// <inheritdoc />
	/// <exception cref="JsonException"><paramref name="value"/> is not a defined group operator.</exception>
	public override void Write(Utf8JsonWriter writer, LoginRuleConditionGroupOperator value, JsonSerializerOptions options)
	{
		writer.WriteStringValue(value switch
		{
			LoginRuleConditionGroupOperator.All => "all",
			LoginRuleConditionGroupOperator.Any => "any",
			_ => throw new JsonException($"Unsupported login rule group operator '{value}'.")
		});
	}
}

/// <summary>
/// Serialises <see cref="LoginRuleConditionValue"/> as either a string or an integer.
/// </summary>
public sealed class LoginRuleConditionValueJsonConverter : JsonConverter<LoginRuleConditionValue>
{
	/// <inheritdoc />
	/// <exception cref="JsonException">The token is not a string or a number that fits in a 32-bit integer.</exception>
	public override LoginRuleConditionValue Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		return reader.TokenType switch
		{
			JsonTokenType.String => LoginRuleConditionValue.FromText(reader.GetString() ?? string.Empty),
			JsonTokenType.Number when reader.TryGetInt32(out var numberValue) => LoginRuleConditionValue.FromNumber(numberValue),
			JsonTokenType.Number => throw new JsonException("Rule condition number values must fit within a 32-bit integer."),
			_ => throw new JsonException("Rule condition values must be either a string or an integer.")
		};
	}

	/// <inheritdoc />
	/// <exception cref="JsonException"><paramref name="value"/> holds neither text nor a number.</exception>
	public override void Write(Utf8JsonWriter writer, LoginRuleConditionValue value, JsonSerializerOptions options)
	{
		if (value.HasText)
		{
			writer.WriteStringValue(value.Text);
			return;
		}

		if (value.HasNumber)
		{
			var number = value.Number;
			if (!number.HasValue)
			{
				throw new JsonException("Rule condition values must contain a numeric value before being written as a number.");
			}

			writer.WriteNumberValue(number.Value);
			return;
		}

		throw new JsonException("Rule condition values must contain either text or a number.");
	}
}

/// <summary>
/// Metadata describing a single Le Løgin rule condition operator — its arity (single/set/range).
/// </summary>
/// <param name="Arity"><c>single</c> (one value), <c>set</c> (one or more values) or <c>range</c> (two bounds).</param>
public sealed record ConditionOperatorMetadata(string Arity);

/// <summary>
/// Metadata describing a Le Løgin rule condition field: which operators are valid, the
/// default value to use when a new condition is created, and optional allowed values.
/// </summary>
/// <param name="Operators">Wire names of the operators the editor offers for this field.</param>
/// <param name="DefaultValue">Value of a newly added condition: a string or an integer.</param>
/// <param name="AllowedValues">The values the field accepts, or <see langword="null"/> when unrestricted.</param>
public sealed record ConditionFieldMetadata(
	IReadOnlyList<string> Operators,
	object DefaultValue,
	IReadOnlyList<object>? AllowedValues = null);

/// <summary>
/// Full metadata catalogue for all Le Løgin condition operators and fields.
/// Consumed by the backoffice UI to drive the condition editor without baking the
/// rules into client-side code.
/// </summary>
/// <param name="Operators">Operator metadata keyed by operator wire name.</param>
/// <param name="Fields">Field metadata keyed by field wire name.</param>
public sealed record ConditionMetadataResponse(
	IReadOnlyDictionary<string, ConditionOperatorMetadata> Operators,
	IReadOnlyDictionary<string, ConditionFieldMetadata> Fields);

/// <summary>
/// Converts between the API condition model and the stored JsonLogic representation.
/// </summary>
public static class LoginRuleConditionJsonMapper
{
	/// <summary>Parses a stored JsonLogic condition string into the editable group model.</summary>
	/// <param name="conditionJson">The stored JsonLogic text.</param>
	/// <param name="fallbackIdPrefix">Prefix for the generated condition ids (<c>{prefix}-1</c>, <c>{prefix}-2</c>, …).</param>
	/// <returns>The condition group.</returns>
	/// <exception cref="InvalidOperationException">The text is blank, not valid JSON, or not a supported JsonLogic shape.</exception>
	public static LoginRuleConditionGroupModel ToConditionGroupModel(string conditionJson, string fallbackIdPrefix)
	{
		if (string.IsNullOrWhiteSpace(conditionJson))
		{
			throw new InvalidOperationException("Stored rule condition must contain JSON.");
		}

		try
		{
			using var document = JsonDocument.Parse(conditionJson);
			return ToConditionGroupModel(document.RootElement, fallbackIdPrefix);
		}
		catch (JsonException exception)
		{
			throw new InvalidOperationException("Stored rule condition must contain valid JSON.", exception);
		}
	}

	/// <summary>
	/// Converts a JsonLogic <c>and</c>/<c>or</c> group into the editable group model. Supports
	/// <c>==</c>, <c>!=</c>, <c>in</c>, a <c>&gt;=</c>/<c>&lt;=</c> range pair, and <c>!</c> negation of those.
	/// </summary>
	/// <param name="condition">The JsonLogic group object.</param>
	/// <param name="fallbackIdPrefix">Prefix for the generated condition ids (<c>{prefix}-1</c>, <c>{prefix}-2</c>, …).</param>
	/// <returns>The condition group.</returns>
	/// <exception cref="InvalidOperationException">The element is not a supported JsonLogic shape, field or value type.</exception>
	public static LoginRuleConditionGroupModel ToConditionGroupModel(JsonElement condition, string fallbackIdPrefix)
	{
		if (condition.ValueKind != JsonValueKind.Object)
		{
			throw new InvalidOperationException("Stored rule condition must be a JsonLogic object.");
		}

		JsonElement rawConditions;
		LoginRuleConditionGroupOperator groupOperator;

		if (condition.TryGetProperty("and", out var andCondition))
		{
			groupOperator = LoginRuleConditionGroupOperator.All;
			rawConditions = andCondition;
		}
		else if (condition.TryGetProperty("or", out var orCondition))
		{
			groupOperator = LoginRuleConditionGroupOperator.Any;
			rawConditions = orCondition;
		}
		else
		{
			throw new InvalidOperationException("Stored rule condition must use either 'and' or 'or'.");
		}

		if (rawConditions.ValueKind != JsonValueKind.Array)
		{
			throw new InvalidOperationException("Stored rule condition groups must contain an array of conditions.");
		}

		var conditions = new List<LoginRuleConditionModel>();
		var index = 0;
		foreach (var rawCondition in rawConditions.EnumerateArray())
		{
			index++;
			conditions.Add(ToConditionModel(rawCondition, $"{fallbackIdPrefix}-{index}"));
		}

		return new LoginRuleConditionGroupModel(groupOperator, conditions);
	}

	/// <summary>Converts the editable group model into its stored JsonLogic form.</summary>
	/// <param name="conditionGroup">The condition group to convert.</param>
	/// <returns>A JsonLogic <c>and</c> or <c>or</c> object. Condition ids are not stored.</returns>
	/// <exception cref="InvalidOperationException">A condition has the wrong number of values for its operator, or a value of the wrong type for its field.</exception>
	public static JsonElement ToJsonElement(LoginRuleConditionGroupModel conditionGroup)
	{
		var groupOperator = conditionGroup.Operator == LoginRuleConditionGroupOperator.All ? "and" : "or";
		var comparisons = conditionGroup.Conditions.Select(BuildConditionJsonLogic).ToList();

		return JsonSerializer.SerializeToElement(new Dictionary<string, object?>
		{
			[groupOperator] = comparisons
		});
	}

	/// <summary>Converts the editable group model into the JsonLogic text stored on a rule.</summary>
	/// <param name="conditionGroup">The condition group to convert.</param>
	/// <returns>The raw JsonLogic text.</returns>
	/// <exception cref="InvalidOperationException">A condition is invalid; see <see cref="ToJsonElement"/>.</exception>
	public static string ToStoredJson(LoginRuleConditionGroupModel conditionGroup) =>
		ToJsonElement(conditionGroup).GetRawText();

	private static LoginRuleConditionModel ToConditionModel(JsonElement value, string fallbackId)
	{
		if (value.ValueKind != JsonValueKind.Object)
		{
			throw new InvalidOperationException("Stored rule condition entries must be objects.");
		}

		// `!` wrapper around `in` / between → negated forms (notIn / notBetween).
		if (value.TryGetProperty("!", out var negatedExpression))
		{
			if (negatedExpression.ValueKind != JsonValueKind.Object)
			{
				throw new InvalidOperationException("Negated rule conditions must wrap an object expression.");
			}

			var inner = ToConditionModel(negatedExpression, fallbackId);
			return inner with { Operator = NegateOperator(inner.Operator) };
		}

		// `in` → membership test (`in` / `notIn` after negation handling above).
		if (value.TryGetProperty("in", out var inExpression))
		{
			return ToInConditionModel(inExpression, fallbackId, LoginRuleConditionOperator.In);
		}

		// Range (`between` / `notBetween`) is stored as `and: [{">=":[var,lo]}, {"<=":[var,hi]}]`.
		if (value.TryGetProperty("and", out var rangeAnd) && TryParseRangeGroup(rangeAnd, fallbackId, out var rangeModel))
		{
			return rangeModel;
		}

		// Equality (`is` / `isNot`).
		JsonElement comparison;
		LoginRuleConditionOperator comparisonOperator;

		if (value.TryGetProperty("==", out var equalsCondition))
		{
			comparisonOperator = LoginRuleConditionOperator.Is;
			comparison = equalsCondition;
		}
		else if (value.TryGetProperty("!=", out var notEqualsCondition))
		{
			comparisonOperator = LoginRuleConditionOperator.IsNot;
			comparison = notEqualsCondition;
		}
		else
		{
			throw new InvalidOperationException("Stored rule conditions must use a supported JsonLogic operator.");
		}

		if (comparison.ValueKind != JsonValueKind.Array || comparison.GetArrayLength() != 2)
		{
			throw new InvalidOperationException("Stored rule condition comparisons must contain exactly two operands.");
		}

		using var enumerator = comparison.EnumerateArray();
		enumerator.MoveNext();
		var left = enumerator.Current;
		enumerator.MoveNext();
		var right = enumerator.Current;

		var variableOperand = TryGetVariableName(left, out var leftVariableName)
			? (VariableName: leftVariableName, Literal: right)
			: TryGetVariableName(right, out var rightVariableName)
				? (VariableName: rightVariableName, Literal: left)
				: throw new InvalidOperationException("Stored rule conditions must compare a field variable against a literal value.");

		var field = ParseField(variableOperand.VariableName);
		var literalValue = ParseConditionValue(field, variableOperand.Literal);

		return new LoginRuleConditionModel(fallbackId, field, comparisonOperator, new[] { literalValue });
	}

	private static LoginRuleConditionModel ToInConditionModel(
		JsonElement inExpression,
		string fallbackId,
		LoginRuleConditionOperator @operator)
	{
		if (inExpression.ValueKind != JsonValueKind.Array || inExpression.GetArrayLength() != 2)
		{
			throw new InvalidOperationException("Stored 'in' conditions must contain exactly two operands.");
		}

		using var enumerator = inExpression.EnumerateArray();
		enumerator.MoveNext();
		var variableElement = enumerator.Current;
		enumerator.MoveNext();
		var arrayElement = enumerator.Current;

		if (!TryGetVariableName(variableElement, out var variableName))
		{
			throw new InvalidOperationException("Stored 'in' conditions must reference a field variable.");
		}

		if (arrayElement.ValueKind != JsonValueKind.Array || arrayElement.GetArrayLength() == 0)
		{
			throw new InvalidOperationException("Stored 'in' conditions must list at least one literal value.");
		}

		var field = ParseField(variableName);
		var values = new List<LoginRuleConditionValue>();
		foreach (var literal in arrayElement.EnumerateArray())
		{
			values.Add(ParseConditionValue(field, literal));
		}

		return new LoginRuleConditionModel(fallbackId, field, @operator, values);
	}

	private static bool TryParseRangeGroup(
		JsonElement rangeAnd,
		string fallbackId,
		out LoginRuleConditionModel model)
	{
		model = default!;

		if (rangeAnd.ValueKind != JsonValueKind.Array || rangeAnd.GetArrayLength() != 2)
		{
			return false;
		}

		using var enumerator = rangeAnd.EnumerateArray();
		enumerator.MoveNext();
		var lower = enumerator.Current;
		enumerator.MoveNext();
		var upper = enumerator.Current;

		if (!TryReadRangeBound(lower, ">=", out var lowVariable, out var lowLiteral))
		{
			return false;
		}

		if (!TryReadRangeBound(upper, "<=", out var highVariable, out var highLiteral))
		{
			return false;
		}

		if (lowVariable != highVariable)
		{
			return false;
		}

		var field = ParseField(lowVariable);
		model = new LoginRuleConditionModel(
			fallbackId,
			field,
			LoginRuleConditionOperator.Between,
			new[]
			{
				ParseConditionValue(field, lowLiteral),
				ParseConditionValue(field, highLiteral)
			});
		return true;
	}

	private static bool TryReadRangeBound(
		JsonElement bound,
		string expectedOperator,
		out string variableName,
		out JsonElement literal)
	{
		variableName = string.Empty;
		literal = default;

		if (bound.ValueKind != JsonValueKind.Object)
		{
			return false;
		}

		if (!bound.TryGetProperty(expectedOperator, out var operands))
		{
			return false;
		}

		if (operands.ValueKind != JsonValueKind.Array || operands.GetArrayLength() != 2)
		{
			return false;
		}

		using var enumerator = operands.EnumerateArray();
		enumerator.MoveNext();
		var first = enumerator.Current;
		enumerator.MoveNext();
		var second = enumerator.Current;

		// Expected shape per side: `>=`: [var, low], `<=`: [var, high].
		if (!TryGetVariableName(first, out variableName))
		{
			return false;
		}

		literal = second;
		return true;
	}

	private static LoginRuleConditionOperator NegateOperator(LoginRuleConditionOperator @operator) =>
		@operator switch
		{
			LoginRuleConditionOperator.In => LoginRuleConditionOperator.NotIn,
			LoginRuleConditionOperator.NotIn => LoginRuleConditionOperator.In,
			LoginRuleConditionOperator.Between => LoginRuleConditionOperator.NotBetween,
			LoginRuleConditionOperator.NotBetween => LoginRuleConditionOperator.Between,
			LoginRuleConditionOperator.Is => LoginRuleConditionOperator.IsNot,
			LoginRuleConditionOperator.IsNot => LoginRuleConditionOperator.Is,
			_ => throw new InvalidOperationException($"Cannot negate operator '{@operator}'.")
		};

	private static object BuildConditionJsonLogic(LoginRuleConditionModel condition)
	{
		ValidateCondition(condition);

		return condition.Operator switch
		{
			LoginRuleConditionOperator.Is => BuildEqualityJsonLogic(condition, "=="),
			LoginRuleConditionOperator.IsNot => BuildEqualityJsonLogic(condition, "!="),
			_ => throw new InvalidOperationException($"Operator '{condition.Operator}' is not supported.")
		};
	}

	private static Dictionary<string, object?[]> BuildEqualityJsonLogic(
		LoginRuleConditionModel condition,
		string comparisonOperator)
	{
		return new Dictionary<string, object?[]>
		{
			[comparisonOperator] =
			[
				new Dictionary<string, string>
				{
					["var"] = ToVariableName(condition.Field)
				},
				condition.Values[0].ToPrimitive()
			]
		};
	}

	private static bool TryGetVariableName(JsonElement operand, out string variableName)
	{
		variableName = string.Empty;
		if (operand.ValueKind != JsonValueKind.Object ||
			!operand.TryGetProperty("var", out var variableElement) ||
			variableElement.ValueKind != JsonValueKind.String)
		{
			return false;
		}

		variableName = variableElement.GetString() ?? string.Empty;
		return true;
	}

	private static LoginRuleField ParseField(string variableName) =>
		variableName switch
		{
			"weekday" => LoginRuleField.Weekday,
			"month" => LoginRuleField.Month,
			_ => throw new InvalidOperationException($"Stored rule condition field '{variableName}' is not supported.")
		};

	private static string ToVariableName(LoginRuleField field) =>
		field switch
		{
			LoginRuleField.Weekday => "weekday",
			LoginRuleField.Month => "month",
			_ => throw new InvalidOperationException($"Rule condition field '{field}' is not supported.")
		};

	private static LoginRuleConditionValue ParseConditionValue(LoginRuleField field, JsonElement literal) =>
		field switch
		{
			LoginRuleField.Month when literal.ValueKind == JsonValueKind.Number && literal.TryGetInt32(out var monthValue) && monthValue is >= 1 and <= 12 =>
				LoginRuleConditionValue.FromNumber(monthValue),
			LoginRuleField.Month when literal.ValueKind == JsonValueKind.Number && literal.TryGetInt32(out _) =>
				throw new InvalidOperationException("Stored month conditions must use a value between 1 and 12."),
			LoginRuleField.Month when literal.ValueKind == JsonValueKind.Number =>
				throw new InvalidOperationException("Stored month conditions must fit within a 32-bit integer."),
			LoginRuleField.Month =>
				throw new InvalidOperationException("Stored month conditions must use numeric values."),
			LoginRuleField.Weekday when literal.ValueKind == JsonValueKind.String && literal.GetString() is { } weekday && AllowedWeekdays.Contains(weekday) =>
				LoginRuleConditionValue.FromText(weekday),
			LoginRuleField.Weekday when literal.ValueKind == JsonValueKind.String =>
				throw new InvalidOperationException($"Stored weekday condition value '{literal.GetString()}' is not supported."),
			_ => throw new InvalidOperationException($"Stored {ToVariableName(field)} conditions must use text values.")
		};

	private static readonly HashSet<string> AllowedWeekdays = new(StringComparer.Ordinal)
	{
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
		"sunday",
	};

	private static void ValidateCondition(LoginRuleConditionModel condition)
	{
		if (condition.Values.Count == 0)
		{
			throw new InvalidOperationException("Rule conditions must contain at least one value.");
		}

		switch (condition.Operator)
		{
			case LoginRuleConditionOperator.Is:
			case LoginRuleConditionOperator.IsNot:
				if (condition.Values.Count != 1)
				{
					throw new InvalidOperationException("'is' / 'isNot' conditions must contain exactly one value.");
				}
				break;

			default:
				throw new InvalidOperationException($"Rule condition operator '{condition.Operator}' is not supported.");
		}

		foreach (var value in condition.Values)
		{
			switch (condition.Field)
			{
				case LoginRuleField.Month:
					if (!value.HasNumber)
					{
						throw new InvalidOperationException("Month conditions must use numeric values.");
					}

					if (value.Number is < 1 or > 12)
					{
						throw new InvalidOperationException("Month conditions must use a value between 1 and 12.");
					}
					break;

				case LoginRuleField.Weekday:
					if (!value.HasText)
					{
						throw new InvalidOperationException("Weekday conditions must use text values.");
					}

					if (!AllowedWeekdays.Contains(value.Text!))
					{
						throw new InvalidOperationException($"Weekday condition value '{value.Text}' is not supported.");
					}
					break;

				default:
					throw new InvalidOperationException($"Rule condition field '{condition.Field}' is not supported.");
			}
		}
	}
}
