using LeLøgin.Core.Storage;
using Moq;
using Umbraco.Cms.Core.IO;
using Xunit;

namespace LeLøgin.Tests.Storage;

public sealed class LeLøginPublishFileManagerTests
{
	[Fact]
	public void GetPublicUrl_Throws_When_Underlying_FileSystem_Returns_Null()
	{
		var fileSystem = new Mock<IFileSystem>();
		fileSystem.Setup(x => x.GetUrl(It.IsAny<string>())).Returns((string?)null);
		var manager = new LeLøginPublishFileManager(fileSystem.Object);

		var ex = Assert.Throws<InvalidOperationException>(() => manager.GetPublicUrl("abc.jpg"));
		Assert.Contains("abc.jpg", ex.Message);
	}

	[Fact]
	public void GetPublicUrl_Returns_The_Underlying_Url_When_Present()
	{
		var fileSystem = new Mock<IFileSystem>();
		fileSystem.Setup(x => x.GetUrl("abc.jpg")).Returns("/login-screen/abc.jpg");
		var manager = new LeLøginPublishFileManager(fileSystem.Object);

		Assert.Equal("/login-screen/abc.jpg", manager.GetPublicUrl("abc.jpg"));
	}
}
