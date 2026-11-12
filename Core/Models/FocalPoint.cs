namespace LeLøgin.Core.Models;

/// <summary>
/// Normalised focal-point coordinates within a login image asset (0–1 on both axes).
/// Mirrors UmbFocalPointModel in the Umbraco backoffice so the same payload shape flows
/// between the client cropper element and the ImageSharp.Web rxy URL parameter.
/// </summary>
public sealed class FocalPoint
{
	/// <summary>Horizontal position, from 0 (left edge) to 1 (right edge).</summary>
	public double Left { get; set; }

	/// <summary>Vertical position, from 0 (top edge) to 1 (bottom edge).</summary>
	public double Top { get; set; }
}
