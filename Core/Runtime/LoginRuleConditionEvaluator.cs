using System.Globalization;
using System.Text.Json;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Validates and evaluates the supported JsonLogic subset for Le Løgin rules.
/// </summary>
public static class LoginRuleConditionEvaluator
{
	public static bool IsSupportedCondition(JsonElement condition)
	{
		var validationContext = new LoginRuntimeContext("monday", 1, "2026-01-01", "localhost");
		return TryEvaluate(condition, validationContext, out _);
	}

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
			case "date":
				value = OperandValue.FromText(context.Date);
				return true;
			case "hostname":
				value = OperandValue.FromText(context.Hostname);
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
