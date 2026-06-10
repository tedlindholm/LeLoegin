using System.Diagnostics.CodeAnalysis;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Source of randomness used when a rule resolves to more than one image and one must be
/// picked at random. Abstracted so the resolver stays deterministic under unit test.
/// </summary>
public interface ILeLøginRandom
{
	/// <summary>
	/// Returns a random index in the range <c>[0, count)</c>, used to pick one image from a set.
	/// </summary>
	int NextIndex(int count);
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
	public int NextIndex(int count) => Random.Shared.Next(count);
}
