using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// Golden-value tests pinning the server crop window. The matching TypeScript
/// helper in <c>Client/lib/auth-view/compute-crop-region.test.ts</c> mirrors
/// these exact cases — if either side moves, both must move together or the
/// editor preview drifts from runtime.
/// </summary>
public sealed class LoginScreenCropRegionTests
{
	[Fact]
	public void Returns_Full_Image_For_Zoom_At_Or_Below_One()
	{
		var fp = new FocalPoint { Left = 0.3, Top = 0.6 };

		Assert.Equal(new LoginScreenCropRegion(0, 0, 1, 1), LoginScreenCropRegion.Compute(fp, 1d));
		Assert.Equal(new LoginScreenCropRegion(0, 0, 1, 1), LoginScreenCropRegion.Compute(fp, 0.5));
		Assert.Equal(new LoginScreenCropRegion(0, 0, 1, 1), LoginScreenCropRegion.Compute(null, double.NaN));
	}

	[Fact]
	public void Treats_Zoom_Within_Tolerance_Of_One_As_NoOp()
	{
		Assert.Equal(
			new LoginScreenCropRegion(0, 0, 1, 1),
			LoginScreenCropRegion.Compute(new FocalPoint { Left = 0.3, Top = 0.6 }, 1.0005));
	}

	[Fact]
	public void Matches_RuntimeControllerTests_Golden_For_Fp_0p3_0p6_Zoom_2()
	{
		// Same input that RuntimeControllerTests expects to round-trip to
		// "cc=0.05,0.35,0.45,0.15" on the wire.
		var region = LoginScreenCropRegion.Compute(new FocalPoint { Left = 0.3, Top = 0.6 }, 2d);

		Assert.Equal(0.05, region.X1, 6);
		Assert.Equal(0.35, region.Y1, 6);
		Assert.Equal(0.55, region.X2, 6);
		Assert.Equal(0.85, region.Y2, 6);
		Assert.True(region.IsZoomed);
	}

	[Fact]
	public void Clamps_Focal_Point_So_Window_Stays_Symmetric_Near_An_Edge()
	{
		// fp.left = 0.1 with zoom 2 (half = 0.25) → fp is clamped to 0.25 so the
		// window slides flush against the left edge but keeps its full 0.5 width.
		// Without this clamp the window would narrow to 0.35 wide and the editor
		// would appear to "zoom in" as the user panned the focal point sideways.
		var region = LoginScreenCropRegion.Compute(new FocalPoint { Left = 0.1, Top = 0.5 }, 2d);

		Assert.Equal(0d, region.X1, 6);
		Assert.Equal(0.25, region.Y1, 6);
		Assert.Equal(0.5, region.X2, 6);
		Assert.Equal(0.75, region.Y2, 6);
	}

	[Fact]
	public void Falls_Back_To_Image_Centre_When_Focal_Point_Is_Null()
	{
		var region = LoginScreenCropRegion.Compute(null, 2d);

		Assert.Equal(new LoginScreenCropRegion(0.25, 0.25, 0.75, 0.75), region);
	}
}
