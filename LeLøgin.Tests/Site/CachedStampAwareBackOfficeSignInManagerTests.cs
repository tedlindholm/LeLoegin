using System.Security.Claims;
using LeLøgin.Tests.Site;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Api.Management.Security;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Net;
using Umbraco.Cms.Core.Persistence.Repositories;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Security;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Security;
using Umbraco.Cms.Web.Common.Security;
using Xunit;

namespace LeLøgin.Tests.Site;

public sealed class CachedStampAwareBackOfficeSignInManagerTests
{
	private const string UserId = "-1";
	private const string UserName = "ted.lindholm@nltg.com";
	private const string PrincipalStamp = "NEW-STAMP";
	private const string CachedStamp = "OLD-STAMP";
	private const string SessionId = "b2b2b45a-1064-4795-b502-5431aaeee852";

	[Fact]
	public async Task ValidateSecurityStampAsync_Returns_Fresh_User_When_Cached_Stamp_Is_Stale_But_Current_Session_Is_Valid()
	{
		BackOfficeIdentityUser cachedUser = CreateUser(UserId, UserName);
		BackOfficeIdentityUser freshUser = CreateUser(UserId, UserName);
		var userRepository = new Mock<IUserRepository>();
		var uncachedUser = new Mock<IUser>();
		uncachedUser.SetupGet(user => user.SecurityStamp).Returns(PrincipalStamp);
		userRepository
			.Setup(repository => repository.Get(-1, true))
			.Returns(uncachedUser.Object);
		var scopeProvider = CreateScopeProvider();
		using var userManager = CreateUserManager(cachedUser, freshUser, CachedStamp, PrincipalStamp, sessionIsValid: true);
		var signInManager = CreateSignInManager(userManager, userRepository.Object, scopeProvider.Object);

		BackOfficeIdentityUser? validatedUser = await signInManager.ValidateSecurityStampAsync(CreatePrincipal(signInManager.Options));

		Assert.Same(freshUser, validatedUser);
		Assert.Equal(1, userManager.FindByNameCalls);
		userRepository.Verify(repository => repository.Get(-1, true), Times.Once);
	}

	[Fact]
	public async Task ValidateSecurityStampAsync_Returns_Null_When_Session_Id_Is_Invalid()
	{
		BackOfficeIdentityUser cachedUser = CreateUser(UserId, UserName);
		BackOfficeIdentityUser freshUser = CreateUser(UserId, UserName);
		var userRepository = new Mock<IUserRepository>();
		var uncachedUser = new Mock<IUser>();
		uncachedUser.SetupGet(user => user.SecurityStamp).Returns(PrincipalStamp);
		userRepository
			.Setup(repository => repository.Get(-1, true))
			.Returns(uncachedUser.Object);
		var scopeProvider = CreateScopeProvider();
		using var userManager = CreateUserManager(cachedUser, freshUser, CachedStamp, PrincipalStamp, sessionIsValid: false);
		var signInManager = CreateSignInManager(userManager, userRepository.Object, scopeProvider.Object);

		BackOfficeIdentityUser? validatedUser = await signInManager.ValidateSecurityStampAsync(CreatePrincipal(signInManager.Options));

		Assert.Null(validatedUser);
		Assert.Equal(0, userManager.FindByNameCalls);
		userRepository.Verify(repository => repository.Get(-1, true), Times.Once);
	}

	private static Mock<ICoreScopeProvider> CreateScopeProvider()
	{
		var scope = new Mock<ICoreScope>();
		var scopeProvider = new Mock<ICoreScopeProvider>();
		scopeProvider
			.Setup(provider => provider.CreateCoreScope(default, default, null, null, null, false, true))
			.Returns(scope.Object);
		return scopeProvider;
	}

	private static CachedStampAwareBackOfficeSignInManager CreateSignInManager(
		TestBackOfficeUserManager userManager,
		IUserRepository userRepository,
		ICoreScopeProvider coreScopeProvider)
	{
		var identityOptions = CreateIdentityOptions();
		return new CachedStampAwareBackOfficeSignInManager(
			userManager,
			new HttpContextAccessor { HttpContext = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() } },
			Mock.Of<IBackOfficeExternalLoginProviders>(),
			Mock.Of<IUserClaimsPrincipalFactory<BackOfficeIdentityUser>>(),
			Options.Create(identityOptions),
			Options.Create(new GlobalSettings { DefaultUILanguage = "en-GB" }),
			NullLogger<SignInManager<BackOfficeIdentityUser>>.Instance,
			Mock.Of<IAuthenticationSchemeProvider>(),
			Mock.Of<IUserConfirmation<BackOfficeIdentityUser>>(),
			Mock.Of<IEventAggregator>(),
			Options.Create(new SecuritySettings()),
			Options.Create(new BackOfficeAuthenticationTypeSettings()),
			Mock.Of<IRequestCache>(),
			userRepository,
			coreScopeProvider,
			NullLogger<CachedStampAwareBackOfficeSignInManager>.Instance);
	}

	private static TestBackOfficeUserManager CreateUserManager(
		BackOfficeIdentityUser cachedUser,
		BackOfficeIdentityUser freshUser,
		string cachedStamp,
		string freshStamp,
		bool sessionIsValid)
	{
		var backOfficeIdentityOptions = new BackOfficeIdentityOptions();
		ConfigureIdentityClaims(backOfficeIdentityOptions.ClaimsIdentity);

		return new TestBackOfficeUserManager(
			Mock.Of<IIpResolver>(),
			Mock.Of<IUserSecurityStampStore<BackOfficeIdentityUser>>(),
			Options.Create(backOfficeIdentityOptions),
			new PasswordHasher<BackOfficeIdentityUser>(),
			Array.Empty<IUserValidator<BackOfficeIdentityUser>>(),
			Array.Empty<IPasswordValidator<BackOfficeIdentityUser>>(),
			new BackOfficeErrorDescriber(Mock.Of<ILocalizedTextService>()),
			new ServiceCollection().BuildServiceProvider(),
			new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
			NullLogger<UserManager<BackOfficeIdentityUser>>.Instance,
			Options.Create(new UserPasswordConfigurationSettings()),
			Mock.Of<IEventAggregator>(),
			Mock.Of<IBackOfficeUserPasswordChecker>(),
			Options.Create(new GlobalSettings { DefaultUILanguage = "en-GB" }),
			cachedUser,
			freshUser,
			cachedStamp,
			freshStamp,
			sessionIsValid);
	}

	private static IdentityOptions CreateIdentityOptions()
	{
		var identityOptions = new IdentityOptions();
		ConfigureIdentityClaims(identityOptions.ClaimsIdentity);
		return identityOptions;
	}

	private static void ConfigureIdentityClaims(ClaimsIdentityOptions claimsIdentity)
	{
		claimsIdentity.UserIdClaimType = ClaimTypes.NameIdentifier;
		claimsIdentity.UserNameClaimType = ClaimTypes.Name;
		claimsIdentity.SecurityStampClaimType = "security_stamp";
	}

	private static ClaimsPrincipal CreatePrincipal(IdentityOptions options)
	{
		var identity = new ClaimsIdentity(
			authenticationType: Constants.Security.BackOfficeAuthenticationType,
			nameType: options.ClaimsIdentity.UserNameClaimType,
			roleType: ClaimTypes.Role);
		identity.AddClaim(new Claim(options.ClaimsIdentity.UserIdClaimType, UserId));
		identity.AddClaim(new Claim(options.ClaimsIdentity.UserNameClaimType, UserName));
		identity.AddClaim(new Claim(options.ClaimsIdentity.SecurityStampClaimType, PrincipalStamp));
		identity.AddClaim(new Claim(Constants.Security.SessionIdClaimType, SessionId));
		return new ClaimsPrincipal(identity);
	}

	private static BackOfficeIdentityUser CreateUser(string userId, string userName)
	{
		var user = new BackOfficeIdentityUser(
			new GlobalSettings { DefaultUILanguage = "en-GB" },
			int.Parse(userId, System.Globalization.CultureInfo.InvariantCulture),
			Array.Empty<IReadOnlyUserGroup>())
		{
			UserName = userName,
			Email = userName,
			Name = userName
		};

		return user;
	}

	private sealed class TestBackOfficeUserManager(
		IIpResolver ipResolver,
		IUserStore<BackOfficeIdentityUser> store,
		IOptions<BackOfficeIdentityOptions> optionsAccessor,
		IPasswordHasher<BackOfficeIdentityUser> passwordHasher,
		IEnumerable<IUserValidator<BackOfficeIdentityUser>> userValidators,
		IEnumerable<IPasswordValidator<BackOfficeIdentityUser>> passwordValidators,
		BackOfficeErrorDescriber errors,
		IServiceProvider services,
		IHttpContextAccessor httpContextAccessor,
		ILogger<UserManager<BackOfficeIdentityUser>> logger,
		IOptions<UserPasswordConfigurationSettings> passwordConfiguration,
		IEventAggregator eventAggregator,
		IBackOfficeUserPasswordChecker backOfficeUserPasswordChecker,
		IOptions<GlobalSettings> globalSettings,
		BackOfficeIdentityUser cachedUser,
		BackOfficeIdentityUser freshUser,
		string cachedStamp,
		string freshStamp,
		bool sessionIsValid)
		: BackOfficeUserManager(
			ipResolver,
			store,
			optionsAccessor,
			passwordHasher,
			userValidators,
			passwordValidators,
			errors,
			services,
			httpContextAccessor,
			logger,
			passwordConfiguration,
			eventAggregator,
			backOfficeUserPasswordChecker,
			globalSettings)
	{
		private readonly BackOfficeIdentityUser _cachedUser = cachedUser;
		private readonly string _cachedStamp = cachedStamp;
		private readonly BackOfficeIdentityUser _freshUser = freshUser;
		private readonly string _freshStamp = freshStamp;
		private readonly bool _sessionIsValid = sessionIsValid;

		public int FindByNameCalls { get; private set; }

		public override Task<BackOfficeIdentityUser?> GetUserAsync(ClaimsPrincipal principal) => Task.FromResult<BackOfficeIdentityUser?>(_cachedUser);

		public override Task<BackOfficeIdentityUser?> FindByNameAsync(string userName)
		{
			FindByNameCalls++;
			return Task.FromResult<BackOfficeIdentityUser?>(_freshUser);
		}

		public override Task<string> GetSecurityStampAsync(BackOfficeIdentityUser user) =>
			Task.FromResult(ReferenceEquals(user, _freshUser) ? _freshStamp : _cachedStamp);

		public override Task<bool> ValidateSessionIdAsync(string? userId, string? sessionId) => Task.FromResult(_sessionIsValid);
	}
}