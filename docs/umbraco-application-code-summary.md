# Umbraco Application Code Summary

Reference: [Umbraco Docs: Application Code](https://docs.umbraco.com/umbraco-cms/develop-with-umbraco/application-code)

This document summarises the core concepts and best practices for writing backend application code in modern Umbraco. Umbraco aligns closely with standard ASP.NET Core paradigms.

## 1. Dependency Injection (DI)
Umbraco utilises the native `Microsoft.Extensions.DependencyInjection` container.
- **Usage**: You can inject standard Umbraco services (like `IContentService`, `IMediaService`, `IUmbracoContextAccessor`) directly into your controllers, views, or custom services.
- **Lifetimes**: Services can be registered as `Transient` (new instance every time), `Scoped` (one per HTTP request), or `Singleton` (one instance for the lifetime of the application).

## 2. Composers
Composers (`IComposer`) are the primary mechanism for hooking into the Umbraco startup process to register your own custom code, services, or notifications with the DI container.
- **How it works**: During startup, Umbraco automatically scans for classes implementing `IComposer`.
- **Usage**: 
  ```csharp
  public class MyCustomComposer : IComposer
  {
      public void Compose(IUmbracoBuilder builder)
      {
          // Register a custom service
          builder.Services.AddTransient<IMyService, MyService>();
      }
  }
  ```

## 3. Components
Components (`IComponent`) are used to execute logic when Umbraco starts up or shuts down.
- **Registration**: Components must be appended to the `IUmbracoBuilder` inside a Composer using `builder.Components().Append<MyComponent>()`.
- **Usage**: Implementing `Initialize()` for startup tasks and `Terminate()` for graceful shutdown cleanup. (Note: Many old usages of Components for event wiring have now been replaced by Notifications).

## 4. Notifications (Events)
Notifications represent the event system in Umbraco, replacing the static events used in older versions (v8 and below). It is based on the MediatR pattern.
- **Types of Notifications**: Umbraco fires notifications for almost everything: `ContentPublishingNotification`, `MediaSavedNotification`, `MenuRenderingNotification`, etc.
- **Handling**: Create a class that implements `INotificationHandler<TNotification>`.
- **Registration**: Handlers are registered in a Composer:
  ```csharp
  builder.AddNotificationHandler<ContentPublishedNotification, MyContentPublishedHandler>();
  ```

## 5. Logging
Umbraco uses standard Microsoft `ILogger<T>` for logging, with Serilog configured as the default underlying provider.
- **Usage**: Inject `ILogger<MyClass>` into your constructor.
- **Best Practices**: Use structured logging (message templates) rather than string interpolation so logs can be easily queried in systems like Seq or Application Insights.

## 6. Background Tasks (Hosted Services)
To run recurring or long-running tasks asynchronously in the background, Umbraco relies on standard .NET `IHostedService`.
- **Recurring Tasks**: Umbraco provides a `RecurringHostedServiceBase` base class to easily create tasks that run on a specific interval (e.g., cleanup jobs, syncing external data).
- **Registration**: Registered in a Composer using `builder.Services.AddHostedService<MyBackgroundTask>()`.

## 7. Caching
Umbraco provides multiple caching layers to optimise performance, accessible via the `AppCaches` interface.
- **Request Cache**: Items exist only for the duration of the current HTTP request.
- **Runtime Cache (Memory Cache)**: Application-wide memory caching for expensive database or API calls.
- **Isolated Cache**: A partitioned cache useful for strongly-typed caching without key collisions.

## 8. Profiling
Umbraco integrates **MiniProfiler** to help developers measure the performance of their application code.
- It tracks database queries, execution time of code blocks, and page rendering.
- Wrapped in `using (Profiler.Step("My expensive operation")) { ... }` blocks to measure custom logic.

## Summary
Modern Umbraco development heavily leverages standard ASP.NET Core architectural patterns. **Composers** are your entry point to the application, **Notifications** allow you to react to CMS events, and standard **DI / Logging / Hosted Services** handle the architecture of your custom integrations.

## Le Løgin project note

`Le Løgin` currently applies these backend patterns in a fairly small but production-shaped way:

- A package-specific API base and controller base define the authenticated management API surface under `/umbraco/le-løgin/api/v1/...`
- Public pre-auth runtime endpoints are separated into a dedicated runtime controller base under `/umbraco/le-løgin/api/v1/runtime/...`
- Assets, rules, and settings are persisted in the Umbraco database through the NPoco-backed `LeLøginScreenStore`, which opens its own `IScopeProvider` scope for each operation
- Umbraco migrations own the `LeLoginAssets`, `LeLoginRules`, and singleton `LeLoginSettings` tables
- Source files are stored under `App_Data/LeLøgin/assets/`
- ImageSharp is used to read uploaded image dimensions and generate GUID-backed runtime exposure files under `wwwroot/login-screen/`
- Database-backed startup handlers, anonymous graphics middleware, and public runtime actions remain inert until `IRuntimeState.Level` is exactly `RuntimeLevel.Run`; this allows the package to be present during initial Umbraco database setup
- The current implemented backend scope is:
  - asset upload / list / update / delete
  - publish selected asset as the explicit Le Løgin fallback image
  - settings get / update
  - rule-aware runtime read-only image resolution with GUID-backed public exposure paths
