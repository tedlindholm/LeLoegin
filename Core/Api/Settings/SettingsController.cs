using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;

namespace LeLøgin.Core.Api.Settings;

/// <summary>
/// Manages login screen settings — fallback asset, cache, etc.
/// </summary>
public class SettingsController(ILeLøginScreenStore store) : ApiControllerBase
{
	[HttpGet("settings")]
	[ProducesResponseType<LoginSettings>(StatusCodes.Status200OK)]
	public async Task<IActionResult> Get() => Ok(await store.GetSettingsAsync());

	[HttpPut("settings")]
	[ProducesResponseType<LoginSettings>(StatusCodes.Status200OK)]
	public async Task<IActionResult> Update([FromBody] LoginSettings settings)
	{
		await store.UpdateSettingsAsync(settings);
		return Ok(settings);
	}
}
