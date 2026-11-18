using Xunit;

namespace LeLøgin.Tests.Site;

/// <summary>
/// Test classes that start an Umbraco host run one at a time. Umbraco resolves some services
/// through the process-wide <c>StaticServiceProvider.Instance</c>, which each host overwrites as it
/// starts, so it supports one live host per process; its own integration tests are
/// <c>[NonParallelizable]</c> for the same reason. Tests outside this collection still run in parallel.
/// </summary>
[CollectionDefinition(Name)]
public sealed class UmbracoHostCollection
{
	public const string Name = "Umbraco host";
}
