# Filesystem Providers

## Why this matters

Le Løgin stores uploaded image assets and generated runtime publications (GUID-named JPEG copies of the background images served to the login screen) on disk. By default these files live inside the web application's `App_Data/LeLøgin/` directory and `wwwroot/login-screen/` directory respectively.

On **ephemeral hosts** — Azure App Service, Docker containers, any infrastructure that does not preserve the filesystem between deploys — `App_Data` is wiped on every deployment. Uploaded assets survive a running instance but disappear on redeploy, leaving asset records in the Umbraco database that point to files that no longer exist.

Le Løgin follows Umbraco's own pattern for Media storage to solve this: swap the underlying `IFileSystem` implementation without touching application code.

---

## What Le Løgin stores where

| Manager | Default root | Contains |
|---|---|---|
| `LeLøginAssetFileManager` | `App_Data/LeLøgin/` | Source uploads (`assets/`), WebP thumbnail cache (`thumbnails/`) |
| `LeLøginPublishFileManager` | `wwwroot/login-screen/` | Publicly-servable runtime images (`<guid>.jpg`), one for each background image an enabled rule can show. Logos are served from the source file and are not published here. |

Asset records and rules are stored in the Umbraco database (`LeLoginAssets` and `LeLoginRules`), not in these file systems, so they persist wherever the database does.

---

## Default: `PhysicalFileSystem`

Out of the box, both managers are backed by `PhysicalFileSystem` — Umbraco's built-in local-disk implementation. No configuration is required. This is identical to how Umbraco's Media system works on a single-server deployment.

---

## Overriding the filesystem

Both managers expose Umbraco's `IFileSystem` abstraction. You can replace either one in a custom Umbraco composer to point at any storage backend — Azure Blob Storage, Amazon S3, or any other provider that implements `IFileSystem`.

The packaged `LeLøgin.AzureBlob` adapter treats the Azure storage provider as a host-owned dependency. Its `Umbraco.StorageProviders.AzureBlob` reference uses `PrivateAssets="all"`, so consuming sites must install a provider version compatible with their own Umbraco major version. The adapter nupkg declares only its dependency on `LeLøgin`; see the [adapter installation notes](../LeLøgin.AzureBlob/readme.md#why-the-storage-provider-dependency-is-explicit) for the full dependency policy.

### Extension methods

```csharp
// Swap the asset filesystem (uploads + thumbnails)
builder.SetLoginAssetFileSystem(sp => /* return IFileSystem */);

// Swap the publish filesystem (public runtime images)
builder.SetLoginPublishFileSystem(sp => /* return IFileSystem */);
```

Your composer **must run after** `LeLøginScreenComposer` so it overrides the defaults:

```csharp
[ComposeAfter(typeof(LeLøginScreenComposer))]
public class MyCustomStorageComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.SetLoginAssetFileSystem(sp =>
        {
            // e.g. Azure Blob Storage via Umbraco.StorageProviders.AzureBlob
            // or your own IFileSystem implementation
            return new MyAzureBlobFileSystem(sp);
        });

        builder.SetLoginPublishFileSystem(sp =>
        {
            // GetUrl() must return a URL the site serves, so ImageSharp can crop it
            return new MyAzurePublicBlobFileSystem(sp);
        });
    }
}
```

`SetLogin*FileSystem` uses Umbraco's `AddUnique`, which removes any prior registration and replaces it. This matches the pattern used by `SetMediaFileSystem`.

### Requirements for `LeLøginPublishFileManager`

Give `LeLøginPublishFileManager` a dedicated directory or container that is not shared with other site files. Stale publication clean-up only deletes files matching Le Løgin's publication name shape (`<32 hex characters>.jpg`), but dedicating the root prevents accidental name collisions or unexpected listings.

`IFileSystem.GetUrl(fileName)` must return a URL the browser can fetch. It is returned, with ImageSharp crop parameters added, by `runtime/active`, and the `/login-background` middleware redirects to it. For the focal-point and zoom crop to work, the URL must resolve to a path the site's web root serves, so ImageSharp can process it. For a physical file system this is a path under `wwwroot`. The `LeLøgin.AzureBlob` adapter mounts the publish container on the web root at its `VirtualPath`, as Umbraco does for media. A direct CDN or public blob URL works only if you accept losing the crop.

For `LeLøginAssetFileManager`, `GetUrl` is never called — only `AddFile`, `OpenFile`, `FileExists`, `GetLastModified`, `GetFiles`, and `DeleteFile` are used.

---

## What is not covered

- Umbraco's own Media files — covered by Umbraco's separate `SetMediaFileSystem`.
