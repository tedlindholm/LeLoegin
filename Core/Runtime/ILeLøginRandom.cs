using System.Diagnostics.CodeAnalysis;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Source of the per-render token the login shell puts on every URL that resolves the active
/// image. Abstracted so the shell's output stays deterministic under test.
/// </summary>
public interface ILeLøginRandom
{
	/// <summary>
	/// Returns a token identifying one login page render. The login shell puts the same value on
	/// its background, logo, and greeting URLs so all three resolve to the same image.
	/// </summary>
	int NextRenderToken();
}

/// <summary>
/// Default <see cref="ILeLøginRandom"/> backed by the shared thread-safe <see cref="Random"/>.
/// </summary>
public sealed class LeLøginRandom : ILeLøginRandom
{
	[SuppressMessage(
		"Security",
		"CA5394:Do not use insecure randomness",
		Justification = "Cosmetic login-image rotation — not a security-sensitive value.")]
	public int NextRenderToken() => Random.Shared.Next();
}
