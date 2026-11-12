using System.Globalization;
using System.Text.Json;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Validates and evaluates the supported JsonLogic subset for Le Løgin rules.
/// </summary>
/// <remarks>
/// Supported operators: <c>and</c>, <c>or</c>, <c>!</c>, <c>==</c>, <c>!=</c>, <c>&gt;=</c>,
/// <c>&lt;=</c> and <c>in</c>, over string or integer literals and the variables
/// <c>weekday</c> and <c>month</c>. Anything else makes the condition unsupported.
/// </remarks>
public static class LoginRuleConditionEvaluator
{
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

	/// <summary>
	/// Checks that <paramref name="condition"/> uses only the supported metadata subset:
	/// <c>and</c>, <c>or</c>, <c>!</c>, <c>==</c>, <c>!=</c>, literal booleans, and valid
	/// <c>weekday</c> (<c>monday</c>–<c>sunday</c>) or <c>month</c> (<c>1</c>–<c>12</c>) values.
	/// </summary>
	/// <param name="condition">The parsed JsonLogic condition.</param>
	/// <returns><see langword="true"/> when the condition is well-formed and supported.</returns>
	public static bool IsSupportedCondition(JsonElement condition) =>
		condition.ValueKind switch
		{
			JsonValueKind.True or JsonValueKind.False => true,
			JsonValueKind.Object => IsSupportedObject(condition),
			_ => false
		};

	private static bool IsSupportedObject(JsonElement condition)
	{
		var propertyCount = 0;
		foreach (var property in condition.EnumerateObject())
		{
			propertyCount++;
			if (propertyCount > 1)
			{
				return false;
			}

			switch (property.Name)
			{
				case "and":
				case "or":
					if (property.Value.ValueKind != JsonValueKind.Array)
					{
						return false;
					}

					foreach (var item in property.Value.EnumerateArray())
					{
						if (!IsSupportedCondition(item))
						{
							return false;
						}
					}

					return true;

				case "!":
					return IsSupportedCondition(property.Value);

				case "==":
				case "!=":
					return IsSupportedComparison(property.Value);

				default:
					return false;
			}
		}

		return false;
	}

	private static bool IsSupportedComparison(JsonElement comparison)
	{
		if (comparison.ValueKind != JsonValueKind.Array || comparison.GetArrayLength() != 2)
		{
			return false;
		}

		using var enumerator = comparison.EnumerateArray();
		enumerator.MoveNext();
		var left = enumerator.Current;
		enumerator.MoveNext();
		var right = enumerator.Current;

		if (TryGetVariableName(left, out var leftVar))
		{
			return IsValidFieldLiteral(leftVar, right);
		}

		if (TryGetVariableName(right, out var rightVar))
		{
			return IsValidFieldLiteral(rightVar, left);
		}

		return false;
	}

	private static bool TryGetVariableName(JsonElement operand, out string variableName)
	{
		variableName = string.Empty;
		if (operand.ValueKind != JsonValueKind.Object ||
			!operand.TryGetProperty("var", out var varElement) ||
			varElement.ValueKind != JsonValueKind.String)
		{
			return false;
		}

		variableName = varElement.GetString() ?? string.Empty;
		return true;
	}

	private static bool IsValidFieldLiteral(string variableName, JsonElement literal) =>
		variableName switch
		{
			"weekday" => literal.ValueKind == JsonValueKind.String &&
				literal.GetString() is { } weekday &&
				AllowedWeekdays.Contains(weekday),
			"month" => literal.ValueKind == JsonValueKind.Number &&
				literal.TryGetInt32(out var month) &&
				month is >= 1 and <= 12,
			_ => false
		};

	/// <summary>
	/// Parses and evaluates a JSON condition string. Never throws on malformed JSON.
	/// </summary>
	/// <param name="condition">The condition as stored JSON; blank is treated as unsupported.</param>
	/// <param name="context">The runtime values the condition's variables resolve to.</param>
	/// <param name="result">The condition's outcome; <see langword="false"/> when evaluation fails.</param>
	/// <returns><see langword="true"/> when the condition parsed and is supported.</returns>
	public static bool TryEvaluate(
		string? condition,
		LoginRuntimeContext context,
		out bool result)
	{
		result = false;

		if (string.IsNullOrWhiteSpace(condition))
		{
			return false;
		}

		try
		{
			using var document = JsonDocument.Parse(condition);
			return TryEvaluate(document.RootElement, context, out result);
		}
		catch (JsonException)
		{
			return false;
		}
	}

	/// <summary>
	/// Evaluates a parsed condition. Literal <c>true</c>/<c>false</c> and supported operator
	/// objects are accepted; every other JSON kind is unsupported.
	/// </summary>
	/// <param name="condition">The parsed JsonLogic condition.</param>
	/// <param name="context">The runtime values the condition's variables resolve to.</param>
	/// <param name="result">The condition's outcome; <see langword="false"/> when evaluation fails.</param>
	/// <returns><see langword="true"/> when the condition is supported and was evaluated.</returns>
	public static bool TryEvaluate(
		JsonElement condition,
		LoginRuntimeContext context,
		out bool result)
	{
		result = false;

		switch (condition.ValueKind)
		{
			case JsonValueKind.True:
				result = true;
				return true;
			case JsonValueKind.False:
				result = false;
				return true;
			case JsonValueKind.Object:
				return TryEvaluateObject(condition, context, out result);
			case JsonValueKind.Undefined:
				break;
			case JsonValueKind.Array:
				break;
			case JsonValueKind.String:
				break;
			case JsonValueKind.Number:
				break;
			case JsonValueKind.Null:
				break;
			default:
				return false;
		}

		return false;
	}

	private static bool TryEvaluateObject(
		JsonElement condition,
		LoginRuntimeContext context,
		out bool result)
	{
		result = false;

		foreach (var property in condition.EnumerateObject())
		{
			switch (property.Name)
			{
				case "and":
					return TryEvaluateLogicalGroup(property.Value, context, requireAll: true, out result);
				case "or":
					return TryEvaluateLogicalGroup(property.Value, context, requireAll: false, out result);
				case "!":
					if (!TryEvaluate(property.Value, context, out var inner))
					{
						return false;
					}
					result = !inner;
					return true;
				case "==":
					return TryEvaluateComparison(property.Value, context, ComparisonKind.Equal, out result);
				case "!=":
					return TryEvaluateComparison(property.Value, context, ComparisonKind.NotEqual, out result);
				case ">=":
					return TryEvaluateComparison(property.Value, context, ComparisonKind.GreaterOrEqual, out result);
				case "<=":
					return TryEvaluateComparison(property.Value, context, ComparisonKind.LessOrEqual, out result);
				case "in":
					return TryEvaluateIn(property.Value, context, out result);
				default:
					continue;
			}
		}

		return false;
	}

	private static bool TryEvaluateLogicalGroup(
		JsonElement group,
		LoginRuntimeContext context,
		bool requireAll,
		out bool result)
	{
		result = requireAll;
		if (group.ValueKind != JsonValueKind.Array)
		{
			return false;
		}

		var hasAny = false;
		foreach (var item in group.EnumerateArray())
		{
			hasAny = true;
			if (!TryEvaluate(item, context, out var itemResult))
			{
				result = false;
				return false;
			}

			if (requireAll && !itemResult)
			{
				result = false;
				return true;
			}

			if (!requireAll && itemResult)
			{
				result = true;
				return true;
			}
		}

		if (!hasAny)
		{
			result = true;
			return true;
		}

		result = requireAll;
		return true;
	}

	private static bool TryEvaluateComparison(
		JsonElement comparison,
		LoginRuntimeContext context,
		ComparisonKind kind,
		out bool result)
	{
		result = false;
		if (comparison.ValueKind != JsonValueKind.Array)
		{
			return false;
		}

		using var enumerator = comparison.EnumerateArray();
		if (!enumerator.MoveNext())
		{
			return false;
		}

		var left = enumerator.Current;
		if (!enumerator.MoveNext())
		{
			return false;
		}

		var right = enumerator.Current;
		if (enumerator.MoveNext())
		{
			return false;
		}

		if (!TryResolveOperand(left, context, out var leftValue))
		{
			return false;
		}

		if (!TryResolveOperand(right, context, out var rightValue))
		{
			return false;
		}

		result = kind switch
		{
			ComparisonKind.Equal => leftValue.AsString == rightValue.AsString,
			ComparisonKind.NotEqual => leftValue.AsString != rightValue.AsString,
			ComparisonKind.GreaterOrEqual => CompareOrdered(leftValue, rightValue) >= 0,
			ComparisonKind.LessOrEqual => CompareOrdered(leftValue, rightValue) <= 0,
			_ => false
		};
		return true;
	}

	private static bool TryEvaluateIn(
		JsonElement inExpression,
		LoginRuntimeContext context,
		out bool result)
	{
		result = false;
		if (inExpression.ValueKind != JsonValueKind.Array || inExpression.GetArrayLength() != 2)
		{
			return false;
		}

		using var enumerator = inExpression.EnumerateArray();
		enumerator.MoveNext();
		var variableElement = enumerator.Current;
		enumerator.MoveNext();
		var arrayElement = enumerator.Current;

		if (!TryResolveOperand(variableElement, context, out var contextValue))
		{
			return false;
		}

		if (arrayElement.ValueKind != JsonValueKind.Array)
		{
			return false;
		}

		foreach (var literal in arrayElement.EnumerateArray())
		{
			if (!TryReadLiteral(literal, out var literalValue))
			{
				return false;
			}

			if (contextValue.AsString == literalValue.AsString)
			{
				result = true;
				return true;
			}
		}

		result = false;
		return true;
	}

	private static int CompareOrdered(OperandValue left, OperandValue right)
	{
		// Both number → numeric compare. Otherwise → lexicographic on string form (ISO date safe).
		if (left.AsNumber.HasValue && right.AsNumber.HasValue)
		{
			return left.AsNumber.Value.CompareTo(right.AsNumber.Value);
		}

		return string.CompareOrdinal(left.AsString, right.AsString);
	}

	private static bool TryResolveOperand(
		JsonElement operand,
		LoginRuntimeContext context,
		out OperandValue value)
	{
		value = default;

		switch (operand.ValueKind)
		{
			case JsonValueKind.String:
				value = OperandValue.FromText(operand.GetString() ?? string.Empty);
				return true;
			case JsonValueKind.Number:
				if (!operand.TryGetInt32(out var numericValue))
				{
					return false;
				}

				value = OperandValue.FromNumber(numericValue);
				return true;
			case JsonValueKind.Object:
				if (!operand.TryGetProperty("var", out var variableNameElement) ||
					variableNameElement.ValueKind != JsonValueKind.String)
				{
					return false;
				}

				var variableName = variableNameElement.GetString();
				return TryResolveVariable(variableName, context, out value);
			case JsonValueKind.Undefined:
				break;
			case JsonValueKind.Array:
				break;
			case JsonValueKind.True:
				break;
			case JsonValueKind.False:
				break;
			case JsonValueKind.Null:
				break;
			default:
				return false;
		}

		return false;
	}

	private static bool TryReadLiteral(JsonElement literal, out OperandValue value)
	{
		value = default;

		switch (literal.ValueKind)
		{
			case JsonValueKind.String:
				value = OperandValue.FromText(literal.GetString() ?? string.Empty);
				return true;
			case JsonValueKind.Number when literal.TryGetInt32(out var number):
				value = OperandValue.FromNumber(number);
				return true;
			case JsonValueKind.Undefined:
			case JsonValueKind.Object:
			case JsonValueKind.Array:
			case JsonValueKind.Number:
			case JsonValueKind.True:
			case JsonValueKind.False:
			case JsonValueKind.Null:
				break;
			default:
				return false;
		}

		return false;
	}

	private static bool TryResolveVariable(
		string? variableName,
		LoginRuntimeContext context,
		out OperandValue value)
	{
		value = default;

		switch (variableName)
		{
			case "weekday":
				value = OperandValue.FromText(context.Weekday);
				return true;
			case "month":
				value = OperandValue.FromNumber(context.Month);
				return true;
			default:
				return false;
		}
	}

	private enum ComparisonKind
	{
		Equal,
		NotEqual,
		GreaterOrEqual,
		LessOrEqual
	}

	private readonly record struct OperandValue(string AsString, int? AsNumber)
	{
		public static OperandValue FromText(string text) => new(text, null);

		public static OperandValue FromNumber(int number) =>
			new(number.ToString(CultureInfo.InvariantCulture), number);
	}
}
