using System.Text.Json;
using LeLøgin.Core.Runtime;
using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>Checks stored rule conditions through the evaluator's public string and JSON interfaces.</summary>
public sealed class LoginRuleConditionEvaluatorTests
{
	[Theory]
	[InlineData("true", true)]
	[InlineData("false", false)]
	[InlineData("""{"==":[{"var":"weekday"},"monday"]}""", true)]
	[InlineData("""{"==":[{"var":"weekday"},"tuesday"]}""", false)]
	[InlineData("""{"!=":[{"var":"weekday"},"monday"]}""", false)]
	[InlineData("""{"!=":[{"var":"weekday"},"tuesday"]}""", true)]
	[InlineData("""{"==":[{"var":"month"},6]}""", true)]
	[InlineData("""{"==":[{"var":"month"},7]}""", false)]
	[InlineData("""{"!=":[{"var":"month"},6]}""", false)]
	[InlineData("""{"!=":[{"var":"month"},7]}""", true)]
	[InlineData("""{">=":[{"var":"month"},6]}""", true)]
	[InlineData("""{">=":[{"var":"month"},7]}""", false)]
	[InlineData("""{"<=":[{"var":"month"},6]}""", true)]
	[InlineData("""{"<=":[{"var":"month"},5]}""", false)]
	[InlineData("""{">=":[10,2]}""", true)]
	[InlineData("""{"<=":[10,2]}""", false)]
	[InlineData("""{">=":["tuesday","monday"]}""", true)]
	[InlineData("""{"<=":["tuesday","monday"]}""", false)]
	[InlineData("""{"==":[2147483647,2147483647]}""", true)]
	[InlineData("""{"<=":[-2147483648,0]}""", true)]
	[InlineData("""{"in":[{"var":"weekday"},["tuesday","monday"]]}""", true)]
	[InlineData("""{"in":[{"var":"weekday"},["tuesday","friday"]]}""", false)]
	[InlineData("""{"in":[{"var":"month"},[1,6,12]]}""", true)]
	[InlineData("""{"in":[{"var":"month"},[1,12]]}""", false)]
	[InlineData("""{"in":[{"var":"month"},[]]}""", false)]
	[InlineData("""{"!":true}""", false)]
	[InlineData("""{"!":false}""", true)]
	[InlineData("""{"!":{"==":[{"var":"weekday"},"monday"]}}""", false)]
	[InlineData("""{"!":{"==":[{"var":"weekday"},"tuesday"]}}""", true)]
	public void TryEvaluate_Evaluates_Supported_Conditions_Through_Both_Public_Interfaces(string condition, bool expected)
	{
		var context = new LoginRuntimeContext("monday", 6, RenderToken: 0);

		Assert.True(LoginRuleConditionEvaluator.TryEvaluate(condition, context, out var textResult));
		Assert.Equal(expected, textResult);

		using var document = JsonDocument.Parse(condition);
		Assert.True(LoginRuleConditionEvaluator.TryEvaluate(document.RootElement, context, out var jsonResult));
		Assert.Equal(expected, jsonResult);
	}

	[Theory]
	[InlineData("""{"and":[true,true]}""", true)]
	[InlineData("""{"and":[false,true]}""", false)]
	[InlineData("""{"and":[true,false]}""", false)]
	[InlineData("""{"or":[false,false]}""", false)]
	[InlineData("""{"or":[true,false]}""", true)]
	[InlineData("""{"or":[false,true]}""", true)]
	[InlineData("""{"and":[]}""", true)]
	[InlineData("""{"or":[]}""", true)]
	[InlineData("""{"and":[{"or":[false,{"==":[{"var":"weekday"},"monday"]}]},{"!=":[{"var":"month"},12]}]}""", true)]
	[InlineData("""{"and":[{"or":[false,{"==":[{"var":"weekday"},"monday"]}]},{"!=":[{"var":"month"},6]}]}""", false)]
	public void TryEvaluate_Combines_Nested_Conditions_And_Treats_Empty_Groups_As_Catch_All(string condition, bool expected)
	{
		var context = new LoginRuntimeContext("monday", 6, RenderToken: 0);

		Assert.True(LoginRuleConditionEvaluator.TryEvaluate(condition, context, out var result));
		Assert.Equal(expected, result);
	}

	[Theory]
	[InlineData(null)]
	[InlineData("")]
	[InlineData(" \t ")]
	[InlineData("{")]
	[InlineData("not json")]
	[InlineData("null")]
	[InlineData("[]")]
	[InlineData("12")]
	[InlineData("\"monday\"")]
	public void TryEvaluate_Returns_Unsupported_And_False_For_Absent_Malformed_Or_Non_Condition_Json(string? condition)
	{
		var context = new LoginRuntimeContext("monday", 6, RenderToken: 0);

		Assert.False(LoginRuleConditionEvaluator.TryEvaluate(condition, context, out var result));
		Assert.False(result);
	}

	[Theory]
	[InlineData("{}")]
	[InlineData("""{"unsupported":[1,2]}""")]
	[InlineData("""{"and":true}""")]
	[InlineData("""{"or":null}""")]
	[InlineData("""{"and":[true,{}]}""")]
	[InlineData("""{"or":[false,{}]}""")]
	[InlineData("""{"!":{}}""")]
	[InlineData("""{"==":null}""")]
	[InlineData("""{"==":[]}""")]
	[InlineData("""{"==":[1]}""")]
	[InlineData("""{"==":[1,2,3]}""")]
	[InlineData("""{"==":[true,1]}""")]
	[InlineData("""{"==":[1,false]}""")]
	[InlineData("""{"==":[null,1]}""")]
	[InlineData("""{"==":[[],1]}""")]
	[InlineData("""{"==":[{},1]}""")]
	[InlineData("""{"==":[{"var":1},1]}""")]
	[InlineData("""{"==":[{"var":"unknown"},1]}""")]
	[InlineData("""{"==":[1.5,1]}""")]
	[InlineData("""{"==":[2147483648,1]}""")]
	[InlineData("""{"==":[1,-2147483649]}""")]
	[InlineData("""{"in":null}""")]
	[InlineData("""{"in":[]}""")]
	[InlineData("""{"in":[1]}""")]
	[InlineData("""{"in":[1,[],3]}""")]
	[InlineData("""{"in":[{},[1]]}""")]
	[InlineData("""{"in":[1,1]}""")]
	[InlineData("""{"in":[1,[true]]}""")]
	[InlineData("""{"in":[1,[null]]}""")]
	[InlineData("""{"in":[1,[{}]]}""")]
	[InlineData("""{"in":[1,[[]]]}""")]
	[InlineData("""{"in":[1,[1.5]]}""")]
	[InlineData("""{"in":[1,[2147483648]]}""")]
	public void TryEvaluate_Rejects_Unsupported_Operators_Operands_And_Shapes(string condition)
	{
		var context = new LoginRuntimeContext("monday", 6, RenderToken: 0);

		Assert.False(LoginRuleConditionEvaluator.TryEvaluate(condition, context, out _));
	}

	[Fact]
	public void TryEvaluate_Rejects_An_Undefined_Json_Element()
	{
		var context = new LoginRuntimeContext("monday", 6, RenderToken: 0);

		Assert.False(LoginRuleConditionEvaluator.TryEvaluate(default(JsonElement), context, out var result));
		Assert.False(result);
	}

	[Theory]
	[InlineData("""{"==":[{"var":"weekday"},"tuesday"]}""", true)]
	[InlineData("""{"!=":[{"var":"month"},1]}""", true)]
	[InlineData("false", true)]
	[InlineData("""{"unsupported":[1,2]}""", false)]
	[InlineData("""{"==":[{"var":"unknown"},1]}""", false)]
	public void IsSupportedCondition_Distinguishes_A_Non_Match_From_An_Unsupported_Condition(string condition, bool expected)
	{
		using var document = JsonDocument.Parse(condition);

		Assert.Equal(expected, LoginRuleConditionEvaluator.IsSupportedCondition(document.RootElement));
	}
}
