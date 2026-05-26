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
	Weekday,

	Month
}

/// <summary>
/// Supported comparison operators available to a single Le Løgin rule condition.
/// </summary>
[JsonConverter(typeof(LoginRuleConditionOperatorJsonConverter))]
public enum LoginRuleConditionOperator
{
	Is,

	IsNot,

	In,

	NotIn,

	Between,

	NotBetween
}

/// <summary>
/// Supported group operators used to combine multiple Le Løgin rule conditions.
/// </summary>
[JsonConverter(typeof(LoginRuleConditionGroupOperatorJsonConverter))]
public enum LoginRuleConditionGroupOperator
{
	All,

	Any
}

/// <summary>
/// Union-like condition value that serialises as either a string or an integer.
/// </summary>
[JsonConverter(typeof(LoginRuleConditionValueJsonConverter))]
public readonly record struct LoginRuleConditionValue
{
	private LoginRuleConditionValue(string? text, int? number)
	{
		Text = text;
		Number = number;
	}

	public string? Text { get; }

	public int? Number { get; }

	public bool HasText => Text is not null;

	public bool HasNumber => Number.HasValue;

	public static LoginRuleConditionValue FromText(string value) => new(value, null);

	public static LoginRuleConditionValue FromNumber(int value) => new(null, value);

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
public sealed record LoginRuleConditionModel(
	[property: Required] string Id,
	[property: Required] LoginRuleField Field,
	[property: Required] LoginRuleConditionOperator Operator,
	[property: Required] IReadOnlyList<LoginRuleConditionValue> Values);

/// <summary>
/// API model for an editable Le Løgin rule condition group.
/// </summary>
public sealed record LoginRuleConditionGroupModel(
	[property: Required] LoginRuleConditionGroupOperator Operator,
	[property: Required] IReadOnlyList<LoginRuleConditionModel> Conditions);

/// <summary>
/// API model returned for a stored rule.
/// </summary>
public sealed record LoginRuleResponseModel(
	string Id,
	string Name,
	int Priority,
	bool Enabled,
	LoginRuleConditionGroupModel Condition,
	string AssetId);

/// <summary>
/// Request payload for creating or updating a rule.
/// </summary>
public sealed class SaveRuleRequest
{
	public string? Id { get; init; }

	[Required]
	public required string Name { get; init; }

	public int Priority { get; init; }

	public bool Enabled { get; init; } = true;

	[Required]
	public required LoginRuleConditionGroupModel Condition { get; init; }

	[Required]
	public required string AssetId { get; init; }
}

/// <summary>
/// Serialises <see cref="LoginRuleField"/> using the lowercase public contract values.
/// </summary>
public sealed class LoginRuleFieldJsonConverter : JsonConverter<LoginRuleField>
{
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
public sealed record ConditionOperatorMetadata(string Arity);

/// <summary>
/// Metadata describing a Le Løgin rule condition field: which operators are valid, the
/// default value to use when a new condition is created, and optional allowed values.
/// </summary>
public sealed record ConditionFieldMetadata(
	IReadOnlyList<string> Operators,
	object DefaultValue,
	IReadOnlyList<object>? AllowedValues = null);

/// <summary>
/// Full metadata catalogue for all Le Løgin condition operators and fields.
/// Consumed by the backoffice UI to drive the condition editor without baking the
/// rules into client-side code.
/// </summary>
public sealed record ConditionMetadataResponse(
	IReadOnlyDictionary<string, ConditionOperatorMetadata> Operators,
	IReadOnlyDictionary<string, ConditionFieldMetadata> Fields);

/// <summary>
/// Converts between the API condition model and the stored JsonLogic representation.
/// </summary>
public static class LoginRuleConditionJsonMapper
{
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

	public static JsonElement ToJsonElement(LoginRuleConditionGroupModel conditionGroup)
	{
		var groupOperator = conditionGroup.Operator == LoginRuleConditionGroupOperator.All ? "and" : "or";
		var comparisons = conditionGroup.Conditions.Select(BuildConditionJsonLogic).ToList();

		return JsonSerializer.SerializeToElement(new Dictionary<string, object?>
		{
			[groupOperator] = comparisons
		});
	}

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
			LoginRuleConditionOperator.In => BuildInJsonLogic(condition),
			LoginRuleConditionOperator.NotIn => new Dictionary<string, object?>
			{
				["!"] = BuildInJsonLogic(condition)
			},
			LoginRuleConditionOperator.Between => BuildBetweenJsonLogic(condition),
			LoginRuleConditionOperator.NotBetween => new Dictionary<string, object?>
			{
				["!"] = BuildBetweenJsonLogic(condition)
			},
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

	private static Dictionary<string, object?[]> BuildInJsonLogic(LoginRuleConditionModel condition)
	{
		return new Dictionary<string, object?[]>
		{
			["in"] =
			[
				new Dictionary<string, string>
				{
					["var"] = ToVariableName(condition.Field)
				},
				condition.Values.Select(value => value.ToPrimitive()).ToArray()
			]
		};
	}

	private static Dictionary<string, object?[]> BuildBetweenJsonLogic(LoginRuleConditionModel condition)
	{
		var variable = new Dictionary<string, string>
		{
			["var"] = ToVariableName(condition.Field)
		};

		var low = condition.Values[0].ToPrimitive();
		var high = condition.Values[1].ToPrimitive();

		return new Dictionary<string, object?[]>
		{
			["and"] =
			[
				new Dictionary<string, object?[]>
				{
					[">="] = [variable, low]
				},
				new Dictionary<string, object?[]>
				{
					["<="] = [variable, high]
				}
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
			LoginRuleField.Month when literal.ValueKind == JsonValueKind.Number && literal.TryGetInt32(out var monthValue) =>
				LoginRuleConditionValue.FromNumber(monthValue),
			LoginRuleField.Month when literal.ValueKind == JsonValueKind.Number =>
				throw new InvalidOperationException("Stored month conditions must fit within a 32-bit integer."),
			LoginRuleField.Month =>
				throw new InvalidOperationException("Stored month conditions must use numeric values."),
			_ when literal.ValueKind == JsonValueKind.String =>
				LoginRuleConditionValue.FromText(literal.GetString() ?? string.Empty),
			_ => throw new InvalidOperationException($"Stored {ToVariableName(field)} conditions must use text values.")
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

			case LoginRuleConditionOperator.Between:
			case LoginRuleConditionOperator.NotBetween:
				if (condition.Values.Count != 2)
				{
					throw new InvalidOperationException("'between' / 'notBetween' conditions must contain exactly two values.");
				}
				break;

			case LoginRuleConditionOperator.In:
			case LoginRuleConditionOperator.NotIn:
				// At least one value already validated above.
				break;
			default:
				break;
		}

		var fieldName = ToVariableName(condition.Field);

		foreach (var value in condition.Values)
		{
			if (condition.Field == LoginRuleField.Month)
			{
				if (!value.HasNumber)
				{
					throw new InvalidOperationException("Month conditions must use numeric values.");
				}

				continue;
			}

			if (!value.HasText)
			{
				throw new InvalidOperationException($"{CultureInfo.InvariantCulture.TextInfo.ToTitleCase(fieldName)} conditions must use text values.");
			}
		}
	}
}
