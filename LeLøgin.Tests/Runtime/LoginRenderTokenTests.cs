using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// One login page render resolves the active asset from three independent requests — the
/// background image, the logo, and the greeting module. A random rule must pick the same image
/// for all three, or the greeting and logo end up belonging to a different image than the one on
/// screen. The render token carried on all three URLs is what makes them agree.
/// </summary>
public sealed class LoginRenderTokenTests
{
	private static readonly string[] RandomAssetIds = ["asset-a", "asset-b", "asset-c"];

	[Fact]
	public void Independent_Resolutions_Agree_When_They_Share_A_Render_Token()
	{
		// A real randomness source: the token, not the stub, has to be what pins the choice.
		var resolver = new LeLøginScreenRuntimeResolver();
		var context = CreateContext(20260818);

		var resolved = Enumerable
			.Range(0, 50)
			.Select(_ => resolver.ResolveAsset(CreateAssets(), CreateRandomRule(), context)?.Id)
			.Distinct(StringComparer.Ordinal)
			.ToList();

		Assert.Single(resolved);
		Assert.Contains(resolved[0], RandomAssetIds);
	}

	[Fact]
	public void Different_Render_Tokens_Still_Rotate_Across_The_Rules_Images()
	{
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = Enumerable
			.Range(0, RandomAssetIds.Length)
			.Select(token => resolver.ResolveAsset(
				CreateAssets(),
				CreateRandomRule(),
				CreateContext(token))?.Id)
			.ToList();

		// Consecutive tokens walk the candidate list, so a new render can show a different image.
		Assert.Equal(RandomAssetIds.Length, resolved.Distinct(StringComparer.Ordinal).Count());
	}

	[Fact]
	public void A_Negative_Render_Token_Still_Selects_A_Real_Candidate()
	{
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(
			CreateAssets(),
			CreateRandomRule(),
			CreateContext(int.MinValue));

		Assert.NotNull(resolved);
		Assert.Contains(resolved.Id, RandomAssetIds);
	}

	[Fact]
	public void The_Token_Selects_The_Candidate_At_Its_Modulo_Position()
	{
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(CreateAssets(), CreateRandomRule(), CreateContext(2));

		Assert.Equal("asset-c", resolved?.Id);
	}

	[Fact]
	public void The_Context_Factory_Reads_The_Render_Token_From_The_Request()
	{
		var request = new DefaultHttpContext().Request;
		request.QueryString = new QueryString(
			$"?{LoginRuntimeContextFactory.RenderTokenQueryKey}=4711");

		var context = LoginRuntimeContextFactory.Create(request, TimeProvider.System);

		Assert.Equal(4711, context.RenderToken);
	}

	[Theory]
	[InlineData("")]
	[InlineData("?lr=")]
	[InlineData("?lr=not-a-number")]
	public void A_Missing_Or_Unparsable_Render_Token_Falls_Back_To_The_Time_Bucket(string queryString)
	{
		var request = new DefaultHttpContext().Request;
		request.QueryString = new QueryString(queryString);
		var time = new FixedTimeProvider(new DateTimeOffset(2026, 8, 18, 14, 30, 0, TimeSpan.Zero));

		var context = LoginRuntimeContextFactory.Create(request, time);

		Assert.Equal(
			LoginRuntimeContextFactory.Create(new DefaultHttpContext().Request, time).RenderToken,
			context.RenderToken);
	}

	[Fact]
	public void Without_A_Render_Token_Requests_In_The_Same_Bucket_Still_Agree()
	{
		// The logout and session-timeout screens render umb-auth-view, which hardcodes the
		// background and logo URLs with no query string, so no render token can reach them. The
		// time bucket is what keeps those independent requests on the same asset.
		var time = new FixedTimeProvider(new DateTimeOffset(2026, 8, 18, 14, 30, 0, TimeSpan.Zero));

		var first = LoginRuntimeContextFactory.Create(new DefaultHttpContext().Request, time);
		var second = LoginRuntimeContextFactory.Create(new DefaultHttpContext().Request, time);
		Assert.Equal(first.RenderToken, second.RenderToken);
	}

	[Fact]
	public void Requests_In_Different_Buckets_Can_Resolve_Differently()
	{
		var start = new DateTimeOffset(2026, 8, 18, 14, 30, 0, TimeSpan.Zero);
		var earlier = LoginRuntimeContextFactory.Create(
			new DefaultHttpContext().Request,
			new FixedTimeProvider(start));
		var later = LoginRuntimeContextFactory.Create(
			new DefaultHttpContext().Request,
			new FixedTimeProvider(start.AddSeconds(LoginRuntimeContextFactory.BucketSeconds)));

		Assert.NotEqual(earlier.RenderToken, later.RenderToken);
	}

	[Fact]
	public void An_Explicit_Render_Token_Wins_Over_The_Time_Bucket()
	{
		// The Razor login shell supplies its own token, which must keep per-render randomness.
		var request = new DefaultHttpContext().Request;
		request.QueryString = new QueryString(
			$"?{LoginRuntimeContextFactory.RenderTokenQueryKey}=4711");

		var context = LoginRuntimeContextFactory.Create(
			request,
			new FixedTimeProvider(new DateTimeOffset(2026, 8, 18, 14, 30, 0, TimeSpan.Zero)));

		Assert.Equal(4711, context.RenderToken);
	}

	private static LoginRuntimeContext CreateContext(int renderToken = 0) =>
		new("wednesday", 5, renderToken);

	private static LoginImageAsset[] CreateAssets() =>
		[.. RandomAssetIds.Select(id => new LoginImageAsset
		{
			Id = id,
			Name = id,
			StoragePath = $"/tmp/{id}.jpg",
			Width = 1920,
			Height = 1080
		})];

	private sealed class FixedTimeProvider(DateTimeOffset localNow) : TimeProvider
	{
		public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

		public override DateTimeOffset GetUtcNow() => localNow.ToUniversalTime();
	}

	private static LoginRule[] CreateRandomRule() =>
	[
		new LoginRule
		{
			Priority = 10,
			Enabled = true,
			Id = "rule-wednesday-random",
			Name = "Random on Wednesdays",
			AssetIds = [.. RandomAssetIds],
			Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"wednesday\"]}]}"
		}
	];
}
