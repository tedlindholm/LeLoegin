using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using LeLøgin.Core.Api;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using Microsoft.OpenApi;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Every model these tests cover carries a custom <c>JsonConverter</c>, so the OpenAPI
/// generator cannot infer its wire shape from the CLR type and
/// <see cref="ApiConfiguration"/> has to describe it by hand. The generator silently emits
/// an empty schema when that description is missing or mis-keyed — no build break, no
/// startup error, just a degraded document — so these tests pin the shape instead.
/// </summary>
public sealed class ApiConfigurationSchemaTests
{
	private static JsonTypeInfo TypeInfoFor<T>() =>
		JsonSerializerOptions.Default.GetTypeInfo(typeof(T));

	private static IEnumerable<string> EnumValuesOf(OpenApiSchema schema) =>
		(schema.Enum ?? []).Select(node => node!.GetValue<string>());

	[Fact]
	public void LoginImageAssetKind_Is_Described_As_A_String_Enum()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<LoginImageAssetKind>());

		Assert.Equal(JsonSchemaType.String, schema.Type);
		Assert.Equal(["background", "logo"], EnumValuesOf(schema));
	}

	[Fact]
	public void LoginRuleField_Is_Described_As_A_String_Enum()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<LoginRuleField>());

		Assert.Equal(JsonSchemaType.String, schema.Type);
		Assert.Equal(["weekday", "month"], EnumValuesOf(schema));
	}

	[Fact]
	public void LoginRuleConditionOperator_Is_Described_As_A_String_Enum()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<LoginRuleConditionOperator>());

		Assert.Equal(JsonSchemaType.String, schema.Type);
		Assert.Equal(
			["is", "isNot", "in", "notIn", "between", "notBetween"],
			EnumValuesOf(schema));
	}

	[Fact]
	public void LoginRuleConditionGroupOperator_Is_Described_As_A_String_Enum()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<LoginRuleConditionGroupOperator>());

		Assert.Equal(JsonSchemaType.String, schema.Type);
		Assert.Equal(["all", "any"], EnumValuesOf(schema));
	}

	/// <summary>
	/// The regression this suite exists for. <see cref="LoginRuleConditionValue"/>'s converter
	/// leaves its <see cref="JsonTypeInfo"/> opaque, so the generator walks the collection but
	/// never descends into the element — an override keyed on the element type alone is never
	/// invoked and <c>values</c> ships as a bare <c>{"type":"array"}</c> with no items.
	/// </summary>
	[Fact]
	public void Collection_Of_LoginRuleConditionValue_Describes_Its_Items_As_String_Or_Integer()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(
			schema,
			TypeInfoFor<IReadOnlyList<LoginRuleConditionValue>>());

		var items = Assert.IsType<OpenApiSchema>(schema.Items);
		Assert.Collection(
			items.OneOf!,
			text => Assert.Equal(JsonSchemaType.String, Assert.IsType<OpenApiSchema>(text).Type),
			number =>
			{
				var integer = Assert.IsType<OpenApiSchema>(number);
				Assert.Equal(JsonSchemaType.Integer, integer.Type);
				Assert.Equal("int32", integer.Format);
			});
	}

	[Fact]
	public void Collection_Of_An_Unrelated_Element_Type_Is_Left_Alone()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<IReadOnlyList<string>>());

		Assert.Null(schema.Items);
		Assert.Null(schema.Type);
	}

	[Fact]
	public void Model_Without_A_Custom_Converter_Is_Left_Alone()
	{
		var schema = new OpenApiSchema { Type = JsonSchemaType.Object };

		ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<FocalPoint>());

		Assert.Equal(JsonSchemaType.Object, schema.Type);
		Assert.Null(schema.Enum);
		Assert.Null(schema.OneOf);
	}

	/// <summary>
	/// The enum values are the public wire contract, so they must not pick up the ambient
	/// culture's casing rules — a Turkish-locale <c>ToLower</c> on "isNot" would ship "ısnot".
	/// </summary>
	[Fact]
	public void Enum_Values_Do_Not_Depend_On_The_Ambient_Culture()
	{
		var original = CultureInfo.CurrentCulture;
		try
		{
			CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
			var schema = new OpenApiSchema();

			ApiConfiguration.ApplySchemaOverride(schema, TypeInfoFor<LoginRuleConditionOperator>());

			Assert.Equal(
				["is", "isNot", "in", "notIn", "between", "notBetween"],
				EnumValuesOf(schema));
		}
		finally
		{
			CultureInfo.CurrentCulture = original;
		}
	}
}
