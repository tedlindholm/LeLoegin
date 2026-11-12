using Xunit;

namespace LeLøgin.Tests.Storage;

/// <summary>
/// Pins how the blob-like test double filters <c>GetFiles</c>. The double copies the Azure Blob
/// provider, which matches a filter as a literal substring, so these tests keep the other
/// <c>BlobLike*</c> tests honest: a glob that matches nothing on Azure must match nothing here too.
/// </summary>
public sealed class LiteralFilterFileSystemTests : IDisposable
{
	private readonly string _contentRootPath = Path.Combine(
		Path.GetTempPath(),
		"LeLøgin.Tests",
		Guid.NewGuid().ToString("N"));

	public LiteralFilterFileSystemTests()
	{
		var folder = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets");
		Directory.CreateDirectory(folder);
		File.WriteAllText(Path.Combine(folder, "0123abcd.png"), "source");
		File.WriteAllText(Path.Combine(folder, "0123abcd_thumb.jpg"), "thumbnail");
		File.WriteAllText(Path.Combine(folder, "fedcba98.png"), "other");
	}

	[Fact]
	public void GetFiles_Matches_A_Glob_Pattern_Against_No_File()
	{
		var fileSystem = new TestFileSystems.LiteralFilterFileSystem(
			TestFileSystems.AssetFileManager(_contentRootPath).FileSystem);

		Assert.Empty(fileSystem.GetFiles("assets", "0123abcd.*"));
	}

	[Fact]
	public void GetFiles_Matches_A_Plain_Substring_Against_Every_File_That_Contains_It()
	{
		var fileSystem = new TestFileSystems.LiteralFilterFileSystem(
			TestFileSystems.AssetFileManager(_contentRootPath).FileSystem);

		var matches = fileSystem.GetFiles("assets", "0123abcd").Select(path => Path.GetFileName(path) ?? string.Empty).Order(StringComparer.Ordinal).ToArray();

		Assert.Equal(["0123abcd.png", "0123abcd_thumb.jpg"], matches);
	}

	[Fact]
	public void GetFiles_Treats_A_Leading_Star_As_Nothing_And_Returns_All_Files_For_Star_Dot_Star()
	{
		var fileSystem = new TestFileSystems.LiteralFilterFileSystem(
			TestFileSystems.AssetFileManager(_contentRootPath).FileSystem);

		Assert.Equal(3, fileSystem.GetFiles("assets", "*.*").Count());
		Assert.Equal(3, fileSystem.GetFiles("assets", "").Count());
	}

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
	}
}
