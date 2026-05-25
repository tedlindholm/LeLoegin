namespace LeLøgin.Core.Models;

/// <summary>
/// Normalised focal-point coordinates within a login image asset (0–1 on both axes).
/// Mirrors UmbFocalPointModel in the Umbraco backoffice so the same payload shape flows
/// between the client cropper element and the ImageSharp.Web rxy URL parameter.
/// </summary>
public sealed class FocalPoint
{
	public double Left { get; set; }
	public double Top { get; set; }
}
