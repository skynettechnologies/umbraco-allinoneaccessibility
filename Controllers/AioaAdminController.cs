using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using AllinOneAccessibility.Configuration;
using AllinOneAccessibility.Services;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Security;

namespace AllinOneAccessibility.Controllers;

/// <summary>
/// The All in One Accessibility settings page and its AJAX route, for
/// signed-in backoffice users.
///
/// GET  /umbraco/backoffice/aioa          The settings page (the reference
///                                        implementation's rendered layout,
///                                        shipped as page.html with
///                                        placeholders).
/// POST /umbraco/backoffice/aioa/route    ?action=fetchWidgetSettings |
///                                        registerDomain | getDashboardLink |
///                                        fetchScanDetails - JSON, exactly the
///                                        reference server's route contract.
///
/// Secured with the Umbraco back-office authentication scheme (the constant is
/// stable across Umbraco 10 -> latest). The route additionally requires the
/// antiforgery token that umbraco-adapter.js appends to every call.
/// </summary>
[Authorize(AuthenticationSchemes = Constants.Security.BackOfficeAuthenticationType)]
[Route("umbraco/backoffice/aioa")]
public sealed class AioaAdminController : ControllerBase
{
    private static readonly object TemplateLock = new();
    private static string? _templateCache;

    private readonly IAioaService _aioa;
    private readonly IAntiforgery _antiforgery;
    private readonly IWebHostEnvironment _environment;
    private readonly IBackOfficeSecurityAccessor _backOfficeSecurity;
    private readonly AioaOptions _options;

    public AioaAdminController(
        IAioaService aioa,
        IAntiforgery antiforgery,
        IWebHostEnvironment environment,
        IBackOfficeSecurityAccessor backOfficeSecurity,
        IOptions<AioaOptions> options)
    {
        _aioa = aioa;
        _antiforgery = antiforgery;
        _environment = environment;
        _backOfficeSecurity = backOfficeSecurity;
        _options = options.Value;
    }

    /* ---------- The page ---------- */

    [HttpGet("")]
    public IActionResult Index()
    {
        var template = LoadTemplate();
        if (template is null)
        {
            return Content(
                "<!doctype html><title>All in One Accessibility</title>" +
                "<p>The settings page template is missing. Rebuild the website so the " +
                "AllinOneAccessibility package can copy its App_Plugins files, then reload.</p>",
                "text/html; charset=utf-8");
        }

        var domain = ResolveDomain();
        var user = _backOfficeSecurity.BackOfficeSecurity?.CurrentUser;
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);

        // Dark mode is hidden: the page always renders light, matching the backoffice.
        // data-theme="light" also defeats the prefers-color-scheme:dark fallback in tokens.css.
        var themeAttr = " data-theme=\"light\"";

        var html = template
            .Replace("__AIOA_DOMAIN__", JsonText(domain))
            .Replace("__AIOA_NAME__", JsonText(user?.Name ?? string.Empty))
            .Replace("__AIOA_EMAIL__", JsonText(user?.Email ?? string.Empty))
            .Replace("__AIOA_ROUTE_URL__", "/umbraco/backoffice/aioa/route")
            .Replace("__AIOA_THEME_ATTR__", themeAttr)
            .Replace("__AIOA_CSRF_FIELD__", HtmlAttr(tokens.FormFieldName))
            .Replace("__AIOA_CSRF__", HtmlAttr(tokens.RequestToken ?? string.Empty));

        return Content(html, "text/html; charset=utf-8");
    }

    /* ---------- The route (same contract as the reference server.js) ---------- */

    [HttpPost("route")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Route([FromQuery] string? action, CancellationToken ct)
    {
        string Field(string name) => Request.HasFormContentType ? (Request.Form[name].LastOrDefault() ?? string.Empty) : string.Empty;

        var url = Field("url");

        object result = action switch
        {
            "fetchWidgetSettings" => await _aioa.FetchWidgetSettingsAsync(url, ct),
            "registerDomain" => await _aioa.RegisterDomainAsync(url, Field("username"), Field("email"), Field("no_required_eu"), ct),
            "getDashboardLink" => await _aioa.GetDashboardLinkAsync(url, ct),
            "fetchScanDetails" => await _aioa.GetScanDetailsAsync(url, ct),
            _ => new Dictionary<string, string> { ["error"] = "Unknown action." },
        };

        return new JsonResult(result);
    }

    /* ---------- Helpers ---------- */

    private string ResolveDomain()
        => string.IsNullOrWhiteSpace(_options.Domain) ? Request.Host.Host : _options.Domain!.Trim();

    /// <summary>The page.html template from App_Plugins, cached after the first read.</summary>
    private string? LoadTemplate()
    {
        if (_templateCache is not null)
        {
            return _templateCache;
        }

        var path = Path.Combine(_environment.ContentRootPath,
            "App_Plugins", "AllinOneAccessibility", "settings", "page.html");
        if (!System.IO.File.Exists(path))
        {
            return null;
        }

        lock (TemplateLock)
        {
            _templateCache ??= System.IO.File.ReadAllText(path);
        }

        return _templateCache;
    }

    /// <summary>Escape a value for a JSON string inside a &lt;script&gt; block.</summary>
    private static string JsonText(string value)
    {
        // JavaScriptEncoder.Default escapes quotes, <, >, & and non-ASCII, so the
        // value can neither break the JSON string nor close the script element.
        return JavaScriptEncoder.Default.Encode(value);
    }

    private static string HtmlAttr(string value) => HtmlEncoder.Default.Encode(value);
}
