using LeLøgin.Core.Storage.Migrations;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Migrations;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Migrations;
using Xunit;

namespace LeLøgin.Tests.Storage.Migrations;

public sealed class LeLoginMigrationNotificationHandlerTests
{
	[Fact]
	public async Task HandleAsync_Completes_Without_Migration_Access_For_An_Unknown_Non_Running_Level()
	{
		var nonRunningLevel = (RuntimeLevel)101;
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(nonRunningLevel);
		var handler = new LeLoginMigrationNotificationHandler(
			new Mock<IMigrationPlanExecutor>(MockBehavior.Strict).Object,
			new Mock<ICoreScopeProvider>(MockBehavior.Strict).Object,
			new Mock<IKeyValueService>(MockBehavior.Strict).Object,
			runtimeState.Object);

		await handler.HandleAsync(
			new UmbracoApplicationStartingNotification(nonRunningLevel, isRestarting: false),
			CancellationToken.None);
	}
}
