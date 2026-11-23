namespace AllinOneAccessibility.Configuration;

/// <summary>
/// Configuration for the All in One Accessibility package. The constants mirror
/// the AIOA_* values in the reference implementation's app/config.js; the
/// instance properties can be overridden from appsettings.json under
/// "AllinOneAccessibility":
///
/// "AllinOneAccessibility": {
///   "Domain": "www.your-public-site.com",
///   "InjectWidget": true,
///   "TimeoutSeconds": 30
/// }
///
/// Everything has a default, so the package works with no configuration at all
/// (the domain falls back to the host of the current request, matching the
/// reference page's window.location.hostname fallback).
/// </summary>
public sealed class AioaOptions
{
    public const string SectionName = "AllinOneAccessibility";

    /* ---------- Skynet Technologies API (AIOA_* in app/config.js) ---------- */

    /// <summary>Base URL of the API that stores widget registrations and settings.</summary>
    public const string ApiBase = "https://ada.skynettechnologies.us/api/";

    /// <summary>Platform sent to the API when a free widget is registered.</summary>
    public const string Platform = "Umbraco";

    /// <summary>
    /// User-Agent for the server's API calls: the API firewall rejects requests
    /// without one (HTTP 406).
    /// </summary>
    public const string UserAgent = "AIOA-Settings/1.0";

    /// <summary>
    /// Settings endpoint the widget itself reads. Returns the widget position for
    /// mobile, so a paid plan's mobile fields are read from here.
    /// </summary>
    public const string WidgetSettingsApi = "https://freeada.skynettechnologies.com/api/widget-settings";

    /// <summary>
    /// Plan details of a website (paid plans). Its "manage_domain" is the dashboard
    /// sign-in link. POST "domain" (plain, not base64).
    /// </summary>
    public const string CheckWebsiteApi = "https://ada.skynettechnologies.us/check-website";

    /// <summary>
    /// EU check called by the admin's browser once, before a new website is
    /// registered (in_eu -> no_required_eu). Printed into the page's boot data.
    /// </summary>
    public const string GeoApi = "https://ipapi.co/json";

    /// <summary>"Upgrade to Paid Plan" destination.</summary>
    public const string UpgradeUrl = "https://ada.skynettechnologies.us/trial-subscription";

    /// <summary>Save endpoint the browser posts the settings form to (boot data).</summary>
    public const string ApiUpdateUrl = "https://ada.skynettechnologies.us/api/widget-setting-update-platform";

    /* ---------- SkynetAccessibility Scanner API (Accessibility Score tab) ---------- */

    /// <summary>Scan results of a domain. No trailing slash (it 301s).</summary>
    public const string ScanApi = "https://skynetaccessibilityscan.com/api/ada-scanner/domain/details";

    /// <summary>Language of the scan texts.</summary>
    public const string ScanLang = "en";

    /* ---------- Widget defaults ---------- */

    /// <summary>Default widget color (hex without "#").</summary>
    public const string DefaultColor = "420083";

    /* ---------- Front-end widget embed (from the production WordPress plugin) ---------- */

    /// <summary>The widget script injected into front-end pages.</summary>
    public const string WidgetScriptUrl =
        "https://www.skynettechnologies.com/accessibility/js/all-in-one-accessibility-js-widget-minify.js";

    /* ---------- Instance settings (appsettings overrides) ---------- */

    /// <summary>
    /// The website domain to register and manage. When null/empty, the host of
    /// the current request is used.
    /// </summary>
    public string? Domain { get; set; }

    /// <summary>
    /// Whether the widget script is injected into front-end pages automatically.
    /// On by default; turn off only when the script is embedded manually.
    /// </summary>
    public bool InjectWidget { get; set; } = true;

    /// <summary>Seconds before a Skynet API call gives up (AIOA_HTTP_TIMEOUT).</summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Minutes the widget-settings used by the front-end embed are cached.
    /// The embed survives API outages by falling back to defaults.
    /// </summary>
    public int EmbedCacheMinutes { get; set; } = 10;
}
