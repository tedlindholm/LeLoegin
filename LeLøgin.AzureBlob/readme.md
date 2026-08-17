# Le Løgin — Azure Blob adapter

Routes Le Løgin's asset and publish file systems through `Umbraco.StorageProviders.AzureBlob`,
so the backoffice login-screen assets can live in Azure Blob Storage instead of the local disk.

## Install

```
dotnet add package Umbraco.StorageProviders.AzureBlob
dotnet add package LeLøgin.AzureBlob
```

`LeLøgin.AzureBlob` brings `LeLøgin` in as a transitive dependency. The Azure storage provider is
an explicit host dependency so the Umbraco application remains in control of its runtime version.

### Why the storage-provider dependency is explicit

The adapter compiles against `Umbraco.StorageProviders.AzureBlob`, but marks that reference with
`PrivateAssets="all"`. Consequently, `LeLøgin.AzureBlob.nupkg` declares only its dependency on
`LeLøgin`; it does not transitively install the storage provider, Umbraco, or the adapter's private
cryptography pin.

Install a storage-provider release compatible with the host's Umbraco major version. An Umbraco 18
site should supply an 18.x provider; when moving the host to Umbraco 19, the host should supply the
corresponding 19.x provider. This lets the site upgrade its Umbraco dependency graph without the
adapter pinning it to the version used to compile the adapter.

The same caveats as the core package apply: NuGet does not enforce the host version, and private
security pins do not flow to the site. Successful restore therefore means only that the package can
be installed; the application must still provide compatible and patched runtime assemblies.

## Wire up

### With a connection string

```csharp
builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddDeliveryApi()
    .AddComposers()
    .AddAzureBlobLoginFileSystems()
    .Build();
```

### With managed identity (service endpoint URI as ConnectionString)

```csharp
builder.CreateUmbracoBuilder()
    .AddBackOffice()
    .AddWebsite()
    .AddDeliveryApi()
    .AddComposers()
    .AddAzureBlobLoginFileSystems(
        assets  => assets.TryCreateBlobContainerClientUsingUri(
                       uri => new BlobContainerClient(uri, new DefaultAzureCredential())),
        publish => publish.TryCreateBlobContainerClientUsingUri(
                       uri => new BlobContainerClient(uri, new DefaultAzureCredential())))
    .Build();
```

## Configure

`appsettings.json`:

```json
{
  "Umbraco": {
    "Storage": {
      "AzureBlob": {
        "LeLoginAssets": {
          "ConnectionString": "<connection-string-or-service-endpoint-uri>",
          "ContainerName": "login"
        },
        "LeLoginPublish": {
          "ConnectionString": "<connection-string-or-service-endpoint-uri>",
          "ContainerName": "login"
        }
      }
    }
  }
}
```

`VirtualPath` defaults to `/le-login/assets` and `/le-login/publish` respectively; the consumer
configure callbacks can override either (`options.VirtualPath = "/..."`).

You can point both sections at the same container with different `VirtualPath`s,
or use separate containers — that's a deployment choice.
