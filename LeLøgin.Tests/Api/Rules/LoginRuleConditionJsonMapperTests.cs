using System.Text.Json;
using LeLøgin.Core.Api.Rules;
using Xunit;

namespace LeLøgin.Tests.Api.Rules;

public sealed class LoginRuleConditionJsonMapperTests
{
	private static readonly JsonSerializerOptions WebJsonSerialiserOptions = new(JsonSerializerDefaults.Web);

	[Fact]
	public void ToConditionGroupModel_Maps_Stored_JsonLogic_To_Typed_Model()
	{
		var storedCondition = ParseJson("""
		{
		  "and": [
		    { "==": [{ "var": "weekday" }, "monday"] },
		    { "!=": [{ "var": "month" }, 7] }
		  ]
		}
		""");

		var mapped = LoginRuleConditionJsonMapper.ToConditionGroupModel(storedCondition, "rule-1-condition");

		Assert.Equal(LoginRuleConditionGroupOperator.All, mapped.Operator);
		Assert.Collection(
			mapped.Conditions,
			first =>
			{
				Assert.Equal("rule-1-condition-1", first.Id);
				Assert.Equal(LoginRuleField.Weekday, first.Field);
				Assert.Equal(LoginRuleConditionOperator.Is, first.Operator);
				var value = Assert.Single(first.Values);
				Assert.Equal("monday", value.Text);
				Assert.Null(value.Number);
			},
			second =>
			{
				Assert.Equal("rule-1-condition-2", second.Id);
				Assert.Equal(LoginRuleField.Month, second.Field);
				Assert.Equal(LoginRuleConditionOperator.IsNot, second.Operator);
				var value = Assert.Single(second.Values);
				Assert.Equal(7, value.Number);
				Assert.Null(value.Text);
			});
	}

	[Fact]
	public void ToJsonElement_Maps_Typed_Model_Back_To_Stored_JsonLogic()
	{
		var conditionGroup = new LoginRuleConditionGroupModel(
			LoginRuleConditionGroupOperator.Any,
			[
				new LoginRuleConditionModel(
					"condition-1",
					LoginRuleField.Weekday,
					LoginRuleConditionOperator.Is,
					[LoginRuleConditionValue.FromText("monday")]),
				new LoginRuleConditionModel(
					"condition-2",
					LoginRuleField.Month,
					LoginRuleConditionOperator.IsNot,
					[LoginRuleConditionValue.FromNumber(12)])
			]);

		var json = LoginRuleConditionJsonMapper.ToJsonElement(conditionGroup);

		Assert.Equal(
			JsonSerializer.Serialize(ParseJson("""
			{
			  "or": [
			    { "==": [{ "var": "weekday" }, "monday"] },
			    { "!=": [{ "var": "month" }, 12] }
			  ]
			}
			""")),
			JsonSerializer.Serialize(json));
	}

	[Fact]
	public void ToConditionGroupModel_Maps_An_Empty_Group_To_A_Catch_All_Model()
	{
		var storedCondition = ParseJson("""
		{
		  "and": []
		}
		""");

		var mapped = LoginRuleConditionJsonMapper.ToConditionGroupModel(storedCondition, "rule-1-condition");

		Assert.Equal(LoginRuleConditionGroupOperator.All, mapped.Operator);
		Assert.Empty(mapped.Conditions);
	}

	[Fact]
	public void ToJsonElement_Maps_An_Empty_Catch_All_Group_Back_To_Stored_JsonLogic()
	{
		var conditionGroup = new LoginRuleConditionGroupModel(
			LoginRuleConditionGroupOperator.All,
			[]);

		var json = LoginRuleConditionJsonMapper.ToJsonElement(conditionGroup);

		Assert.Equal(
			JsonSerializer.Serialize(ParseJson("""
			{
			  "and": []
			}
			""")),
			JsonSerializer.Serialize(json));
	}

	[Fact]
	public void ToJsonElement_Rejects_Invalid_Field_Value_Combinations()
	{
		var conditionGroup = new LoginRuleConditionGroupModel(
			LoginRuleConditionGroupOperator.All,
			[
				new LoginRuleConditionModel(
					"condition-1",
					LoginRuleField.Month,
					LoginRuleConditionOperator.Is,
					[LoginRuleConditionValue.FromText("july")])
			]);

		var exception = Assert.Throws<InvalidOperationException>(() =>
			LoginRuleConditionJsonMapper.ToJsonElement(conditionGroup));

		Assert.Equal("Month conditions must use numeric values.", exception.Message);
	}

	[Fact]
	public void RuleConditionGroupModel_Serialises_Using_Public_Enum_Values()
	{
		var conditionGroup = new LoginRuleConditionGroupModel(
			LoginRuleConditionGroupOperator.All,
			[
				new LoginRuleConditionModel(
					"condition-1",
					LoginRuleField.Weekday,
					LoginRuleConditionOperator.Is,
					[LoginRuleConditionValue.FromText("monday")])
			]);

		var json = JsonSerializer.Serialize(conditionGroup, WebJsonSerialiserOptions);

		Assert.Equal(
			"""{"operator":"all","conditions":[{"id":"condition-1","field":"weekday","operator":"is","values":["monday"]}]}""",
			json);
	}

	private static JsonElement ParseJson(string json) => JsonSerializer.Deserialize<JsonElement>(json);
}
