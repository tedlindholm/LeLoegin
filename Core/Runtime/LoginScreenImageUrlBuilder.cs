using System.Globalization;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using LeLøgin.Core.Models;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Builds the public ImageSharp.Web URL for a login screen image: appends crop/focal-point
/// parameters and, when HMAC is configured, signs the resulting URL so that ImageSharp.Web's
/// request-authorisation middleware accepts it. Shared between the runtime endpoint and the
/// preview-by-rule endpoint so both produce identical URLs.
/// </summary>
public static class LoginScreenImageUrlBuilder
{
	/// <summary>
	/// Appends ImageSharp.Web crop/focal-point parameters to a published image URL and signs
	/// it when HMAC is configured in ImageSharp's middleware options.
	/// </summary>
	public static string ApplyImageProcessing(
		string baseUrl,
		FocalPoint? focalPoint,
		double zoom,
		ImageSharpMiddlewareOptions imageSharpOptions,
		RequestAuthorizationUtilities? requestAuthorizationUtilities,
		ILogger logger)
	{
		Dictionary<string, string?> queryParams = new(StringComparer.OrdinalIgnoreCase);

		var cropRegion = LoginScreenCropRegion.Compute(focalPoint, zoom);
		if (cropRegion.IsZoomed)
		{
			// cc=left,top,right,bottom — insets from each edge (0–1).
			queryParams["cc"] = string.Create(CultureInfo.InvariantCulture,
				$"{cropRegion.X1:0.####},{cropRegion.Y1:0.####},{1d - cropRegion.X2:0.####},{1d - cropRegion.Y2:0.####}");
		}
		else if (focalPoint is not null)
		{
			queryParams["rmode"] = "crop";
			queryParams["rxy"] = string.Create(CultureInfo.InvariantCulture,
				$"{focalPoint.Left:0.####},{focalPoint.Top:0.####}");
		}

		if (queryParams.Count == 0) return baseUrl;

		var url = QueryHelpers.AddQueryString(baseUrl, queryParams);

		// Sign with HMAC when configured — mirrors what ImageSharpImageUrlGenerator does.
		if (imageSharpOptions.HMACSecretKey.Length != 0)
		{
			if (requestAuthorizationUtilities is null)
			{
				// HMAC is required but the signer wasn't resolved from DI — ImageSharp.Web
				// will 400 the unsigned URL. Surface the diagnostic instead of failing silently.
				logger.LogWarning(
					"ImageSharp HMAC is configured but RequestAuthorizationUtilities is not available; emitting unsigned URL which will be rejected by the imaging middleware.");
			}
			else
			{
				var token = requestAuthorizationUtilities.ComputeHMAC(url, CommandHandling.Sanitize);
				if (!string.IsNullOrEmpty(token))
				{
					url = QueryHelpers.AddQueryString(url,
						RequestAuthorizationUtilities.TokenCommand, token);
				}
			}
		}

		return url;
	}
}