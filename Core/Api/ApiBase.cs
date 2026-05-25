using Umbraco.Cms.Api.Management.OpenApi;

namespace LeLøgin.Core.Api;

/// <summary>
/// API identity constants and Swagger security filter for the Login Screen API.
/// </summary>
public class ApiBase : BackOfficeSecurityRequirementsOperationFilterBase
{
	public const string Major = "1";
	public const string Minor = "0";
	public const string LeLøginScreenApiName = $"le-løgin-api-v{Major}";
	public const string LeLøginScreenApiVersion = $"{Major}.{Minor}";

	protected override string ApiName => LeLøginScreenApiName;
}
