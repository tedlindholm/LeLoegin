using System.Globalization;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.DependencyInjection;
using SixLabors.ImageSharp.Web.Middleware;
using Umbraco.Cms.Imaging.ImageSharp.ImageProcessors;
using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// Covers the two behaviours of <see cref="LoginScreenImageUrlBuilder"/> that the controller
/// tests do not reach: the HMAC signing path against a real
/// <see cref="RequestAuthorizationUtilities"/>, and the culture-independence of the crop
/// parameter formatting.
/// </summary>
public sealed class LoginScreenImageUrlBuilderTests
{
	private static readonly byte[] HmacKey =
		[0x4c, 0x65, 0x4c, 0xf8, 0x67, 0x69, 0x6e, 0x21, 0x9a, 0x3f, 0x02, 0xd1];

	/// <summary>
	/// Builds the signer the way Umbraco's imaging registration does, so the token these tests
	/// assert on is the one ImageSharp.Web's authorisation middleware would recompute.
	/// </summary>
	private static RequestAuthorizationUtilities CreateSigner(ImageSharpMiddlewareOptions options)
	{
		var services = new ServiceCollection();

		// Umbraco ships its own CropWebProcessor — `cc` is not an ImageSharp.Web default command.
		// Without it registered, CommandHandling.Sanitize discards `cc` as unknown, leaving
		// nothing to sign and no token on the URL.
		services.AddImageSharp().AddProcessor<CropWebProcessor>();
		services.Configure<ImageSharpMiddlewareOptions>(configured =>
			configured.HMACSecretKey = options.HMACSecretKey);

		return services
			.BuildServiceProvider()
			.GetRequiredService<RequestAuthorizationUtilities>();
	}

	[Fact]
	public void Signs_The_Processed_Url_When_Hmac_Is_Configured()
	{
		var options = new ImageSharpMiddlewareOptions { HMACSecretKey = HmacKey };
		var signer = CreateSigner(options);

		var url = LoginScreenImageUrlBuilder.ApplyImageProcessing(
			"/login-screen/background.jpg",
			new FocalPoint { Left = 0.5, Top = 0.5 },
			zoom: 2d,
			options,
			signer,
			NullLogger.Instance);

		Assert.Contains(
			$"{RequestAuthorizationUtilities.TokenCommand}=",
			url,
			StringComparison.Ordinal);

		// The token must match what the middleware recomputes from the unsigned URL, otherwise
		// ImageSharp.Web rejects the request with a 400 and the login screen falls back to the
		// Umbraco default.
		var unsigned = url[..url.IndexOf($"&{RequestAuthorizationUtilities.TokenCommand}=", StringComparison.Ordinal)];
		var expected = signer.ComputeHMAC(unsigned, CommandHandling.Sanitize);

		Assert.Contains(
			$"{RequestAuthorizationUtilities.TokenCommand}={expected}",
			url,
			StringComparison.Ordinal);
	}

	[Fact]
	public void Does_Not_Sign_When_No_Hmac_Key_Is_Configured()
	{
		var options = new ImageSharpMiddlewareOptions();

		var url = LoginScreenImageUrlBuilder.ApplyImageProcessing(
			"/login-screen/background.jpg",
			new FocalPoint { Left = 0.5, Top = 0.5 },
			zoom: 2d,
			options,
			CreateSigner(options),
			NullLogger.Instance);

		Assert.DoesNotContain(
			RequestAuthorizationUtilities.TokenCommand,
			url,
			StringComparison.Ordinal);
	}

	/// <summary>
	/// ImageSharp.Web parses <c>cc</c> and <c>rxy</c> with invariant culture, so emitting them
	/// under a comma-decimal culture would produce "0,25,0,25,0,25,0,25" — silently unparseable.
	/// </summary>
	[Theory]
	[InlineData("nb-NO")]
	[InlineData("de-DE")]
	public void Formats_Crop_Parameters_Invariantly_Regardless_Of_Culture(string culture)
	{
		var original = CultureInfo.CurrentCulture;
		try
		{
			CultureInfo.CurrentCulture = new CultureInfo(culture);

			var url = LoginScreenImageUrlBuilder.ApplyImageProcessing(
				"/login-screen/background.jpg",
				new FocalPoint { Left = 0.5, Top = 0.5 },
				zoom: 2d,
				new ImageSharpMiddlewareOptions(),
				requestAuthorizationUtilities: null,
				NullLogger.Instance);

			Assert.Contains("cc=0.25,0.25,0.25,0.25", url, StringComparison.Ordinal);
		}
		finally
		{
			CultureInfo.CurrentCulture = original;
		}
	}

	[Theory]
	[InlineData("nb-NO")]
	[InlineData("de-DE")]
	public void Formats_Focal_Point_Parameters_Invariantly_Regardless_Of_Culture(string culture)
	{
		var original = CultureInfo.CurrentCulture;
		try
		{
			CultureInfo.CurrentCulture = new CultureInfo(culture);

			var url = LoginScreenImageUrlBuilder.ApplyImageProcessing(
				"/login-screen/background.jpg",
				new FocalPoint { Left = 0.25, Top = 0.75 },
				zoom: 1d,
				new ImageSharpMiddlewareOptions(),
				requestAuthorizationUtilities: null,
				NullLogger.Instance);

			Assert.Contains("rxy=0.25,0.75", url, StringComparison.Ordinal);
		}
		finally
		{
			CultureInfo.CurrentCulture = original;
		}
	}
}
