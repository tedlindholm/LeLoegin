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

1. synchronises the client and Umbraco manifest versions to the package version
2. builds the client bundle with pnpm
3. packs the NuGet package with the built static web assets

## Versioning

Le Løgin 18.x requires Umbraco 18 or later. Minor and patch releases follow SemVer within that
major. The previous 1.x line targeted Umbraco 17 — 18.0.0 follows 1.2.2 because Umbraco 18 became
the minimum supported host, not because of a sixteen-major jump in the package's own API.

`LeLøgin` and `LeLøgin.AzureBlob` are released together on the same version.

## Installing into an Umbraco site

Add the NuGet package to the Umbraco host application, restore packages, and run the site. Umbraco will discover the packaged static web assets and the included `umbraco-package.json` automatically.

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

- Le Løgin is compiled against Umbraco 18.0.0 as its lowest supported API surface.
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

- Requires Umbraco 18+
- Targets .NET 10
