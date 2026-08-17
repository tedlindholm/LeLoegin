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

The package major tracks the Umbraco major it targets: Le Løgin 18.x targets Umbraco 18.x. Minor
and patch follow SemVer within that major. The previous 1.x line targeted Umbraco 17 — 18.0.0
follows 1.2.2 because of this switch, not because of a sixteen-major jump in the package's own
API.

`LeLøgin` and `LeLøgin.AzureBlob` are released together on the same version.

## Installing into an Umbraco site

Add the NuGet package to the Umbraco host application, restore packages, and run the site. Umbraco will discover the packaged static web assets and the included `umbraco-package.json` automatically.

## Building an adapter against Le Løgin

Le Løgin references only the Umbraco assemblies it uses — `Umbraco.Cms.Api.Management` and
`Umbraco.Cms.Imaging.ImageSharp` — rather than the `Umbraco.Cms` meta-package, so consumers are
not forced to take both persistence providers, EF Core and the backoffice static assets.

One consequence catches adapter authors out. `Umbraco.Cms.Targets`, which the meta-package pulls
in, contributes two global usings; without it, `IUmbracoBuilder` and the `Umbraco.Extensions`
extension methods stop resolving even though the assemblies are present. A project referencing
Le Løgin but not `Umbraco.Cms` needs them declared:

```xml
<ItemGroup>
  <Using Include="Umbraco.Cms.Core.DependencyInjection" />
  <Using Include="Umbraco.Extensions" />
</ItemGroup>
```

Umbraco *sites* are unaffected — they reference `Umbraco.Cms` directly.

## Notes

- Requires Umbraco 18+
- Targets .NET 10