# Filesystem Providers

## Why this matters

Le Løgin stores uploaded image assets and generated runtime publications (the transcoded JPEG/PNG/SVG files served to the login screen) on disk. By default these files live inside the web application's `App_Data/LeLøgin/` directory and `wwwroot/login-screen/` directory respectively.

On **ephemeral hosts** — Azure App Service, Docker containers, any infrastructure that does not preserve the filesystem between deploys — `App_Data` is wiped on every deployment. Uploaded assets survive a running instance but disappear on redeploy, leaving orphaned `config.json` records pointing to files that no longer exist.

Le Løgin follows Umbraco's own pattern for Media storage to solve this: swap the underlying `IFileSystem` implementation without touching application code.

---

## What Le Løgin stores where

| Manager | Default root | Contains |
|---|---|---|
| `LeLøginAssetFileManager` | `App_Data/LeLøgin/` | Source uploads (`assets/`), WebP thumbnail cache (`thumbnails/`) |
| `LeLøginPublishFileManager` | `wwwroot/login-screen/` | Publicly-servable runtime images (`runtime-image-*.jpg`, `runtime-logo-*.svg`) |

`config.json` (managed by `JsonFlatFileDataStore`) is **not** covered by these managers and continues to live in `App_Data/LeLøgin/`. On Azure App Service, mount an Azure Files share to `App_Data/` to make it persistent — see Microsoft's documentation on [persistent storage for App Service](https://learn.microsoft.com/azure/app-service/configure-connect-to-azure-storage).

---

## Default: `PhysicalFileSystem`

Out of the box, both managers are backed by `PhysicalFileSystem` — Umbraco's built-in local-disk implementation. No configuration is required. This is identical to how Umbraco's Media system works on a single-server deployment.

---

## Overriding the filesystem

Both managers expose Umbraco's `IFileSystem` abstraction. You can replace either one in a custom Umbraco composer to point at any storage backend — Azure Blob Storage, Amazon S3, or any other provider that implements `IFileSystem`.

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
            // Public blobs — GetUrl() must return a publicly reachable URL
            return new MyAzurePublicBlobFileSystem(sp);
        });
    }
}
```

`SetLogin*FileSystem` uses Umbraco's `AddUnique`, which removes any prior registration and replaces it. This matches the pattern used by `SetMediaFileSystem`.

### Requirements for `LeLøginPublishFileManager`

`IFileSystem.GetUrl(fileName)` must return a **publicly reachable URL** — this is the URL embedded in the login screen API response that the browser fetches directly. For a physical filesystem this is a path under `wwwroot`. For blob storage it must be a CDN or public blob URL.

For `LeLøginAssetFileManager`, `GetUrl` is never called — only `AddFile`, `OpenFile`, `FileExists`, `GetLastModified`, `GetFiles`, and `DeleteFile` are used.

---

## StoragePath migration

Older Le Løgin installations stored absolute filesystem paths (e.g. `/var/app/App_Data/LeLøgin/assets/abc123.jpg`) in `config.json`. On first startup after upgrading, `LeLøginScreenStore` automatically migrates these to filesystem-relative paths (`assets/abc123.jpg`). The migration is silent, one-time, and requires no action.

---

## What is not covered

- `config.json` — stays on local disk via `JsonFlatFileDataStore`. Use a persistent share (Azure Files, EFS) for it.
- Umbraco's own Media files — covered by Umbraco's separate `SetMediaFileSystem`.
