using LeLøgin.Core.Models;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// The normalised crop window for a focal-point + zoom pair. Mirrors the
/// TypeScript <c>computeCropRegion</c> helper in
/// <c>Client/lib/auth-view/compute-crop-region.ts</c> — both sides must stay in
/// lock-step or the editor preview drifts from what ImageSharp.Web will serve at
/// runtime.
/// </summary>
public readonly record struct LoginScreenCropRegion(double X1, double Y1, double X2, double Y2)
{
	/// <summary>
	/// True when the region represents an actual crop (zoom &gt; 1). False for the
	/// no-op full-image window <c>(0, 0)–(1, 1)</c> returned when no zoom is
	/// configured — callers use this to decide whether to emit <c>cc=</c> at all.
	/// </summary>
	public bool IsZoomed => !(X1 == 0d && Y1 == 0d && X2 == 1d && Y2 == 1d);

	/// <summary>
	/// 1.001 tolerance matches <c>AssetController.NormaliseZoom</c> and the TS
	/// helper, so a zoom of 1 (within float rounding) is treated as no-op and
	/// never produces a <c>cc=</c> query parameter.
	/// </summary>
	private const double ZoomNoopThreshold = 1.001d;

	/// <summary>
	/// Computes the <c>1/zoom × 1/zoom</c> window centred on the focal point. The
	/// focal point itself is clamped to <c>[half, 1 − half]</c> before centring,
	/// so the window can never be clipped to a smaller area near an edge —
	/// clipping shrinks the crop, the cover-fit then has to scale up more to
	/// fill the panel, and the result reads as "the zoom changed while I was
	/// panning" in the editor. The TypeScript helper must mirror this so the
	/// preview stays WYSIWYG.
	/// </summary>
	public static LoginScreenCropRegion Compute(FocalPoint? focalPoint, double zoom)
	{
		if (!double.IsFinite(zoom) || zoom <= ZoomNoopThreshold)
		{
			return new LoginScreenCropRegion(0d, 0d, 1d, 1d);
		}

		var fp = focalPoint ?? new FocalPoint { Left = 0.5, Top = 0.5 };
		var half = 0.5d / zoom;
		var left = Math.Clamp(fp.Left, half, 1d - half);
		var top = Math.Clamp(fp.Top, half, 1d - half);
		return new LoginScreenCropRegion(
			left - half,
			top - half,
			left + half,
			top + half);
	}
}
