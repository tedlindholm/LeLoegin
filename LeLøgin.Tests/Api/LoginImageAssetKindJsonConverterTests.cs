using System.Text.Json;
using LeLøgin.Core.Models;
using Xunit;

namespace LeLøgin.Tests.Api;

public sealed class LoginImageAssetKindJsonConverterTests
{
	[Fact]
	public void LoginImageAssetKind_Serialises_As_Lowercase_Public_Value()
	{
		var json = JsonSerializer.Serialize(LoginImageAssetKind.Background);

		Assert.Equal("\"background\"", json);
	}

	[Fact]
	public void LoginImageAssetKind_Deserialises_From_Lowercase_Public_Value()
	{
		var value = JsonSerializer.Deserialize<LoginImageAssetKind>("\"logo\"");

		Assert.Equal(LoginImageAssetKind.Logo, value);
	}
}
