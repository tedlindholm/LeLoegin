# Le Løgin

<p align="center">
  <img src="./docs/hero.png" alt="Le Løgin hero image" />
</p>

Le Løgin is a distributable Umbraco package for managing the backoffice login-screen image from a dedicated Settings-integrated product area.

## What ships in the package

- the `LeLøgin` Razor Class Library assembly
- static web assets under `App_Plugins/le-løgin`
- `umbraco-package.json` with both backoffice and runtime entry points
- authenticated management APIs plus the public runtime endpoint

## Building the package

`dotnet pack` is the release command.

When packing, the project now:

1. builds the client bundle with pnpm using the selected package version
2. generates its Umbraco manifest without changing the source template
3. packs the NuGet package with the built static web assets

Build each track explicitly:

```bash
dotnet pack LeLøgin.csproj -c Release -p:UmbracoMajor=17
dotnet pack LeLøgin.AzureBlob/LeLøgin.AzureBlob.csproj -c Release -p:UmbracoMajor=17
dotnet pack LeLøgin.csproj -c Release -p:UmbracoMajor=18
dotnet pack LeLøgin.AzureBlob/LeLøgin.AzureBlob.csproj -c Release -p:UmbracoMajor=18
```

Packages are written to `artifacts/v17/` and `artifacts/v18/`.

Client assets are generated under `obj/v{major}/{configuration}/net10.0/client/wwwroot/`.
ASP.NET maps them to the same public `App_Plugins/le-løgin` URLs. The two development sites
therefore serve separate files. Rebuilds finish in a temporary directory before replacing
individual published files; the package manifest is replaced last. Old hashed chunks remain
available to open development tabs until the generated output is cleaned.

## Versioning

Le Løgin builds separate package tracks from the same source: `17.7.x` compiles against
Umbraco 17.7.2, and `18.x` compiles against Umbraco 18.3.0. Both target .NET 10. Select the
package track matching the site's Umbraco major. Minor and patch releases follow SemVer
within each track.

`LeLøgin` and `LeLøgin.AzureBlob` are released together on the same version.

## Installing into an Umbraco site

Add the NuGet package to the Umbraco host application, restore packages, and run the site. Umbraco will discover the packaged static web assets and the included `umbraco-package.json` automatically.

Le Løgin may be added before the site's first Umbraco setup. While Umbraco has no configured
database or is preparing an empty SQLite database, Le Løgin leaves the installer and Umbraco's
default login graphics in control without querying database-backed package services. Its migrations,
runtime resolution, and package-managed user-group provisioning become active when Umbraco reaches
`RuntimeLevel.Run`.

## Runtime dependency ownership

Le Løgin's production `PackageReference` items use `PrivateAssets="all"`. They are compile-time
references for building and testing Le Løgin, but they are deliberately not declared as transitive
dependencies in `LeLøgin.nupkg`. The package therefore does not select, upgrade, or downgrade the
Umbraco assemblies used by the installed application.

This works because Le Løgin is loaded inside an Umbraco host. The host application's own
`Umbraco.Cms` reference supplies the runtime assemblies that `LeLøgin.dll` uses. The host, rather
than the extension package, owns the exact Umbraco, ImageSharp, OpenAPI and cryptography versions
in the deployed dependency graph.

The practical consequences are:

- The default track compiles against Umbraco 18.3.0; `UmbracoMajor=17` selects Umbraco 17.7.2.
- An Umbraco 18 or later host may choose its own compatible minor and patch versions.
- There is no NuGet upper bound preventing installation into Umbraco 19. Runtime compatibility
  still depends on Umbraco 19 retaining the APIs used by Le Løgin.
- NuGet will also allow installation into Umbraco 17 or an ordinary .NET 10 application because
  the nupkg does not declare an Umbraco dependency. Those environments are not supported and may
  fail when the package is loaded.
- Private security pins protect Le Løgin's own build graph but do not flow to consuming sites. The
  host must independently keep its runtime dependencies patched.

In short, `PrivateAssets="all"` makes compatibility a host/runtime contract rather than a NuGet
dependency constraint. It does not make Le Løgin independent of Umbraco.

## Building an adapter against Le Løgin

Le Løgin compiles against only the Umbraco assemblies it uses — `Umbraco.Cms.Api.Management` and
`Umbraco.Cms.Imaging.ImageSharp` — rather than the `Umbraco.Cms` meta-package. These references are
private build-time dependencies: the NuGet package deliberately leaves the installed Umbraco host
in control of its runtime dependency versions.

An adapter project must therefore reference the Umbraco packages it compiles against. If it does
not reference the `Umbraco.Cms` meta-package, it must also declare the two global usings normally
contributed by `Umbraco.Cms.Targets`:

```xml
<ItemGroup>
  <Using Include="Umbraco.Cms.Core.DependencyInjection" />
  <Using Include="Umbraco.Extensions" />
</ItemGroup>
```

Umbraco *sites* already provide these assemblies through their own `Umbraco.Cms` reference.

Libraries which extend Le Løgin may follow the same host-owned model by marking their Umbraco
references private. Their tests and other non-Umbraco hosts must then reference the required
Umbraco packages explicitly; private references do not flow through a project or package reference.

## Notes

- Separate builds for Umbraco 17.7.2 and Umbraco 18.3.0
- Targets .NET 10
