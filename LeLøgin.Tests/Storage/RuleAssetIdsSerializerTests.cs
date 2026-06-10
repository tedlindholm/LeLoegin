using LeLøgin.Core.Storage;
using Xunit;

namespace LeLøgin.Tests.Storage;

public sealed class RuleAssetIdsSerializerTests
{
	[Fact]
	public void Serialize_Writes_A_Json_Array()
	{
		Assert.Equal("""["a","b"]""", RuleAssetIdsSerializer.Serialize(["a", "b"]));
	}

	[Fact]
	public void Serialize_Writes_An_Empty_Array_For_Null_Or_Empty()
	{
		Assert.Equal("[]", RuleAssetIdsSerializer.Serialize(null));
		Assert.Equal("[]", RuleAssetIdsSerializer.Serialize([]));
	}

	[Fact]
	public void Deserialize_Round_Trips_A_Json_Array()
	{
		Assert.Equal(new[] { "a", "b" }, RuleAssetIdsSerializer.Deserialize("""["a","b"]"""));
	}

	[Fact]
	public void Deserialize_Returns_Empty_For_Null_Or_Blank()
	{
		Assert.Empty(RuleAssetIdsSerializer.Deserialize(null));
		Assert.Empty(RuleAssetIdsSerializer.Deserialize("   "));
	}

	[Fact]
	public void Deserialize_Treats_A_Legacy_Bare_Id_As_A_Single_Element_List()
	{
		Assert.Equal(new[] { "asset-1" }, RuleAssetIdsSerializer.Deserialize("asset-1"));
	}

	[Fact]
	public void FromLegacyAssetId_Preserves_An_Existing_Id_As_A_Single_Element_Array()
	{
		// This is the migration's data-preservation contract: an upgraded row keeps its image.
		Assert.Equal("""["asset-1"]""", RuleAssetIdsSerializer.FromLegacyAssetId("asset-1"));
	}

	[Fact]
	public void FromLegacyAssetId_Maps_A_Blank_Id_To_An_Empty_Array()
	{
		Assert.Equal("[]", RuleAssetIdsSerializer.FromLegacyAssetId(""));
		Assert.Equal("[]", RuleAssetIdsSerializer.FromLegacyAssetId(null));
	}
}
