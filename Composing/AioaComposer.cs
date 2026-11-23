using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using AllinOneAccessibility.Configuration;
using AllinOneAccessibility.Middleware;
using AllinOneAccessibility.Services;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Web.Common.ApplicationBuilder;

namespace AllinOneAccessibility.Composing;

/// <summary>
/// Registers the All in One Accessibility services and puts the widget
/// injection middleware into the front-end pipeline. Only version-stable
/// Umbraco APIs are used, so the same assembly serves Umbraco 13 -> latest.
/// </summary>
public sealed class AioaComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services
            .AddOptions<AioaOptions>()
            .Bind(builder.Config.GetSection(AioaOptions.SectionName));

        // Named HttpClient for every Skynet call. A real User-Agent is required:
        // the API firewall answers HTTP 406 without one. Redirects are not
        // followed (matches the reference: ".../details/" would 301).
        builder.Services.AddHttpClient(AioaService.HttpClientName, (sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<AioaOptions>>().Value;
                client.DefaultRequestHeaders.Add("Accept", "application/json");
                client.DefaultRequestHeaders.Add("User-Agent", AioaOptions.UserAgent);
                client.Timeout = TimeSpan.FromSeconds(Math.Max(5, options.TimeoutSeconds));
            })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                AllowAutoRedirect = false,
            });

        builder.Services.AddMemoryCache();
        builder.Services.AddSingleton<IAioaService, AioaService>();

        builder.Services.Configure<UmbracoPipelineOptions>(options =>
        {
            options.AddFilter(new UmbracoPipelineFilter("AllinOneAccessibility")
            {
                PrePipeline = app => app.UseMiddleware<WidgetInjectionMiddleware>(),
            });
        });
    }
}
