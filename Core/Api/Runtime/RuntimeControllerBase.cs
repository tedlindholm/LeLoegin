using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Base controller for public (pre-auth) Login Screen endpoints.
/// No <c>[Authorize]</c> — the login page must fetch the image before the user logs in.
/// </summary>
[ApiController]
[ApiVersion(ApiBase.LeLøginScreenApiVersion)]
[MapToApi(ApiBase.LeLøginScreenApiName)]
[Route(ApiBase.RuntimeRouteTemplate)]
[Produces("application/json")]
public abstract class RuntimeControllerBase : ControllerBase;
