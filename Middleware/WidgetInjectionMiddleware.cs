using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using AllinOneAccessibility.Configuration;
using AllinOneAccessibility.Services;

namespace AllinOneAccessibility.Middleware;

/// <summary>
/// Adds the All in One Accessibility widget script to front-end pages, the
/// same embed the production WordPress plugin enqueues:
///
///   {WidgetScriptUrl}?colorcode={hex}&amp;t={cache buster}&amp;position={position}.{icon type}.{icon size}
///
/// injected before &lt;/body&gt; (the widget loads in the footer). The
/// appearance values come from the website's saved settings at Skynet
/// (widget-settings), cached in memory; when they can't be loaded the
/// reference defaults are used, so the widget still appears. The backoffice,
/// its APIs and static assets are excluded.
/// </summary>
public sealed class WidgetInjectionMiddleware
{
    private const string CachePrefix = "aioa-embed:";

    private static readonly string[] ExcludedPrefixes =
    {
        "/umbraco", "/app_plugins", "/media", "/css", "/scripts", "/api",
    };

    private readonly RequestDelegate _next;

    public WidgetInjectionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(
        HttpContext context,
        IAioaService aioa,
        IMemoryCache cache,
        IOptions<AioaOptions> optionsAccessor)
    {
        var options = optionsAccessor.Value;
        var path = (context.Request.Path.Value ?? string.Empty).ToLowerInvariant();

        if (!options.InjectWidget || ExcludedPrefixes.Any(prefix => path.StartsWith(prefix)))
        {
            await _next(context);
            return;
        }

        var originalBody = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;

        try
        {
            await _next(context);

            context.Response.Body = originalBody;
            buffer.Position = 0;

            var contentType = context.Response.ContentType ?? string.Empty;
            if (!contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase))
            {
                await buffer.CopyToAsync(originalBody);
                return;
            }

            var html = Encoding.UTF8.GetString(buffer.ToArray());
            var bodyEnd = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyEnd < 0)
            {
                buffer.Position = 0;
                await buffer.CopyToAsync(originalBody);
                return;
            }

            var tag = await BuildScriptTagAsync(context, aioa, cache, options);
            html = html.Insert(bodyEnd, tag);

            var bytes = Encoding.UTF8.GetBytes(html);
            context.Response.ContentLength = bytes.Length;
            await originalBody.WriteAsync(bytes);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    /// <summary>
    /// The embed script tag, with the saved appearance values when available
    /// (cached), or the reference defaults.
    /// </summary>
    private static async Task<string> BuildScriptTagAsync(
        HttpContext context, IAioaService aioa, IMemoryCache cache, AioaOptions options)
    {
        var domain = string.IsNullOrWhiteSpace(options.Domain)
            ? context.Request.Host.Host
            : options.Domain!.Trim();

        var cacheKey = CachePrefix + domain;
        if (!cache.TryGetValue(cacheKey, out EmbedSettings? settings))
        {
            try
            {
                settings = await aioa.GetEmbedSettingsAsync(domain, context.RequestAborted);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch
            {
                settings = null;
            }

            // Unregistered / unreachable answers are cached briefly, successful
            // ones for the configured window.
            var minutes = settings is null ? 2 : Math.Max(1, options.EmbedCacheMinutes);
            cache.Set(cacheKey, settings, TimeSpan.FromMinutes(minutes));
        }

        var color = Clean(settings?.ColorCode, AioaOptions.DefaultColor);
        var position = Clean(settings?.Position, "bottom_right");
        var iconType = Clean(settings?.IconType, "aioa-icon-type-1");
        var iconSize = Clean(settings?.IconSize, "aioa-medium-icon");

        var src = AioaOptions.WidgetScriptUrl
                  + "?colorcode=" + Uri.EscapeDataString(color)
                  + "&t=" + Random.Shared.Next(1, 10000001)
                  + "&position=" + Uri.EscapeDataString(position + "." + iconType + "." + iconSize);

        return $"<script id=\"aioa-adawidget\" src=\"{src}\" defer></script>";
    }

    private static string Clean(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
}
