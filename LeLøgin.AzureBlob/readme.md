# Le Løgin — Azure Blob adapter

Routes Le Løgin's asset and publish file systems through `Umbraco.StorageProviders.AzureBlob`,
so the backoffice login-screen assets can live in Azure Blob Storage instead of the local disk.

## Install

```
dotnet add package LeLøgin.AzureBlob
```

This brings `LeLøgin` and `Umbraco.StorageProviders.AzureBlob` in as transitive dependencies.

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
        "LeLøginAssets": {
          "ConnectionString": "<connection-string-or-service-endpoint-uri>",
          "ContainerName": "login"
        },
        "LeLøginPublish": {
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
