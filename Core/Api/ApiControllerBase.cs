using Asp.Versioning;
using LeLøgin.Core.Api.Authorisation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Management.Filters;
using Umbraco.Cms.Web.Common.Authorization;
using Umbraco.Cms.Web.Common.Routing;

namespace LeLøgin.Core.Api;

/// <summary>
/// Base controller for all authenticated Login Screen management endpoints.
/// Requires Settings section access and the Le Løgin manage permission
/// so only authorised users can manage login-screen assets and configuration.
/// </summary>
[ApiController]
[ApiVersion(ApiBase.LeLøginScreenApiVersion)]
[BackOfficeRoute("le-løgin/api/v{version:apiVersion}")]
[MapToApi(ApiBase.LeLøginScreenApiName)]
[Authorize(Policy = AuthorizationPolicies.SectionAccessSettings)]
[Authorize(Policy = LeLøginAuthorisationPolicies.ManageLeLøgin)]
[AppendEventMessages]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase;
