# Architecture & Design Decisions

## Host-Owned Dependencies

Every production `PackageReference` in Le Løgin is marked `PrivateAssets="all"`. The package is
**compiled against** specific versions — Umbraco 18.0, SixLabors.ImageSharp 3.1 — but **declares
none of them as dependencies** in the nupkg.

Instead, the **consuming Umbraco site (the host) owns and supplies these assemblies at runtime**.

### Why?

1. **Multiple Umbraco major versions.** Le Løgin compiles against Umbraco 18.0 as its lowest
   supported API surface and runs on Umbraco 18.x and 19.x. Declaring `Umbraco.Cms (>= 18.0.0)`
   would drag a second Umbraco version into the graph of a site that has already moved on.

2. **The host controls its own version strategy.** Sites have their own patch cadence and upgrade
   timelines. Host ownership keeps an extension package from arbitrating them.

3. **A cleaner transitive graph.** Consumers take a dependency on `LeLøgin` and nothing else.

### Which packages are private, and why

| Package | Reason |
|---------|--------|
| `Umbraco.Cms.Api.Management` | Host owns its Umbraco version. Transitively covers Core, Infrastructure, Web.Common and Api.Common. |
| `Umbraco.Cms.Imaging.ImageSharp` | Host owns its Umbraco version. Supplies the middleware options and HMAC signing used by `LoginScreenImageUrlBuilder`. |
| `SixLabors.ImageSharp` | **Umbraco ships it** — it arrives transitively with `Umbraco.Cms.Imaging.ImageSharp`, so the host already has it. |
| `Microsoft.OpenApi`, `System.Security.Cryptography.Xml` | Security pins that keep vulnerable transitive versions from the 18.0 floor out of Le Løgin's own build graph. |
| `Umbraco.StorageProviders.AzureBlob` (in `LeLøgin.AzureBlob`) | Host owns its storage-provider version; it must match the host's Umbraco major. |

### What this does and does not guarantee

`PrivateAssets="all"` makes compatibility a **host/runtime contract, not a NuGet constraint**. NuGet
enforces nothing here, so:

- An Umbraco 18-or-later host may pick its own compatible minor and patch versions.
- There is no upper bound stopping installation into Umbraco 19. Whether it *works* depends on
  Umbraco 19 retaining the APIs Le Løgin uses.
- Restore also succeeds in an Umbraco 17 site or an ordinary .NET 10 application, because the nupkg
  declares no Umbraco dependency at all. Those environments are unsupported and will fail when the
  package is loaded — a runtime type-load failure, not a restore error. A successful restore is
  therefore not evidence of compatibility.
- The private security pins protect Le Løgin's build graph only. They do **not** flow to consuming
  sites, which must keep their own runtime dependencies patched.

None of this makes Le Løgin independent of Umbraco. It only moves the decision to the host.

## Database Readiness

Le Løgin can be installed before a new Umbraco site has configured or created its database.
Umbraco treats this as a bootable installation state, so package startup hooks and anonymous HTTP
middleware can run while database services are deliberately unavailable.

Le Løgin therefore treats exact `RuntimeLevel.Run` equality as its database-readiness boundary:

| Boundary | Before `Run` | At `Run` |
| --- | --- | --- |
| Schema migration | Returns without opening an Umbraco scope | Runs the Le Løgin migration plan |
| User-group provisioning | Returns without querying `IUserGroupService` | Ensures the package-managed group exists |
| Login graphics middleware | Falls through to Umbraco's default graphics | Resolves the configured Le Løgin graphic |
| Public runtime actions | Returns a safe empty response | Reads the current package configuration |

The check intentionally uses equality, not runtime-level ordering. Install, upgrade, boot-failed,
unknown, and future non-running states must remain database-free. The NPoco store itself stays
strict: a database failure after Umbraco reaches `Run` is an operational error and is not hidden.
During installation, Umbraco's own installer pipeline can answer a public runtime URL before MVC
dispatches the Le Løgin action; in Umbraco 18.1 this is an empty `400` response. The package
contract is that this path remains database-free and never becomes a Le Løgin `500`.

`FreshInstallStartupTests` exercises unconfigured and empty SQLite installation states against the
real site host, then completes an isolated unattended installation and restarts it to prove that
migrations and group provisioning remain active at `Run`. Its content root, database, logs, and
MainDom lock are temporary and never use the development site's database.

### Consumer responsibilities

A consuming site supplies the runtime assemblies through its own Umbraco reference:

```xml
<PackageReference Include="Umbraco.Cms" Version="18.2.1" />
<PackageReference Include="LeLøgin" Version="18.0.0" />
<!-- SixLabors.ImageSharp arrives transitively with Umbraco; pin it explicitly only to
     take a patched version ahead of Umbraco's own floor. -->
```

Adapter and extension projects that build *against* Le Løgin are a different case: private
references do not flow through a package or project reference, so such a project must reference the
Umbraco packages it compiles against itself. See
[Building an adapter against Le Løgin](../readme.md#building-an-adapter-against-le-løgin) for the
global-usings caveat that comes with not referencing the `Umbraco.Cms` meta-package.

### See Also

- [readme.md — Runtime dependency ownership](../readme.md#runtime-dependency-ownership)
- [Fresh-install database-readiness remedy](./plans/fresh-install-database-readiness-remedy-plan.md)
- [Filesystem Providers](./filesystem-providers.md) — the host-owned pattern applied to storage backends
- [LeLøgin.AzureBlob readme](../LeLøgin.AzureBlob/readme.md) — dependency policy for the Azure adapter
