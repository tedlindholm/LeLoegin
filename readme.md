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

## Installing into an Umbraco site

Add the NuGet package to the Umbraco host application, restore packages, and run the site. Umbraco will discover the packaged static web assets and the included `umbraco-package.json` automatically.

## Notes

- Requires Umbraco 17+
- Targets .NET 10