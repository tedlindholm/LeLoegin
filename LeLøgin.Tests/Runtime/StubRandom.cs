using LeLøgin.Core.Runtime;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// Deterministic <see cref="ILeLøginRandom"/> for tests. Always returns the configured index
/// (clamped to the valid range), so random image selection can be asserted exactly.
/// </summary>
public sealed class StubRandom : ILeLøginRandom
{
	private readonly int _index;

	public StubRandom(int index = 0)
	{
		_index = index;
	}

	public int NextIndex(int count) => count <= 0 ? 0 : Math.Min(_index, count - 1);

	/// <summary>Fixed token, so URL assertions stay stable.</summary>
	public int NextRenderToken() => _index;
}
