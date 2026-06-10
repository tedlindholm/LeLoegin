using LeLøgin.Core.Storage;
using Xunit;

namespace LeLøgin.Tests.Storage;

public sealed class RuleAssetIdsSerialiserTests
{
	[Fact]
	public void Serialise_Writes_A_Json_Array()
	{
		Assert.Equal("""["a","b"]""", RuleAssetIdsSerialiser.Serialise(["a", "b"]));
	}

	[Fact]
	public void Serialise_Writes_An_Empty_Array_For_Null_Or_Empty()
	{
		Assert.Equal("[]", RuleAssetIdsSerialiser.Serialise(null));
		Assert.Equal("[]", RuleAssetIdsSerialiser.Serialise([]));
	}

	[Fact]
	public void Deserialise_Round_Trips_A_Json_Array()
	{
		Assert.Equal(new[] { "a", "b" }, RuleAssetIdsSerialiser.Deserialise("""["a","b"]"""));
	}

	[Fact]
	public void Deserialise_Returns_Empty_For_Null_Or_Blank()
	{
		Assert.Empty(RuleAssetIdsSerialiser.Deserialise(null));
		Assert.Empty(RuleAssetIdsSerialiser.Deserialise("   "));
	}

	[Fact]
	public void Deserialise_Treats_A_Legacy_Bare_Id_As_A_Single_Element_List()
	{
		Assert.Equal(new[] { "asset-1" }, RuleAssetIdsSerialiser.Deserialise("asset-1"));
	}

	[Fact]
	public void FromLegacyAssetId_Preserves_An_Existing_Id_As_A_Single_Element_Array()
	{
		// This is the migration's data-preservation contract: an upgraded row keeps its image.
		Assert.Equal("""["asset-1"]""", RuleAssetIdsSerialiser.FromLegacyAssetId("asset-1"));
	}

	[Fact]
	public void FromLegacyAssetId_Maps_A_Blank_Id_To_An_Empty_Array()
	{
		Assert.Equal("[]", RuleAssetIdsSerialiser.FromLegacyAssetId(""));
		Assert.Equal("[]", RuleAssetIdsSerialiser.FromLegacyAssetId(null));
	}
}
