using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AllinOneAccessibility.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AllinOneAccessibility.Services;

/// <summary>
/// C# port of the reference implementation's app/skynet-widget.js: every
/// server-side call to the Skynet Technologies API, with the same action
/// semantics and the same JSON reply shapes the settings page JavaScript
/// expects. Loading never registers; registerDomain registers at most once
/// and re-checks widget-settings first.
/// </summary>
public sealed class AioaService : IAioaService
{
    /// <summary>Named HttpClient registered in the composer.</summary>
    public const string HttpClientName = "AllinOneAccessibility";

    // Widget position for mobile (Paid Features): missing from widget-settings (MOBILE_FIELDS in JS)
    private static readonly string[] MobileFields =
    {
        "is_mobile_position",
        "is_widget_custom_position_mobile",
        "widget_position_mobile",
        "widget_position_top_mobile",
        "widget_position_bottom_mobile",
        "widget_position_left_mobile",
        "widget_position_right_mobile",
        "widget_position_vertical_center_offset_mobile",
        "widget_position_horizontal_center_offset_mobile",
    };

    // Website host: a domain name such as "example.com", or "localhost". Same rule as the page JS.
    private static readonly Regex DomainRe = new(
        @"^(?:localhost|(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$",
        RegexOptions.Compiled);

    // An email address the registration accepts (PHP FILTER_VALIDATE_EMAIL cases)
    private static readonly Regex EmailRe = new(
        @"^(?=.{1,254}$)(?=[^@]{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?![0-9]+$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$",
        RegexOptions.Compiled);

    private static readonly Regex SchemeRe = new(@"^[a-z][a-z0-9+.\-]*://", RegexOptions.Compiled);

    // Score label by minimum score, checked from the top (AIOA_SCORE_LEVELS)
    private static readonly (int Min, string Level, string Status)[] ScoreLevels =
    {
        (85, "compliant", "Compliant"),
        (50, "semi", "Semi Compliant"),
        (0, "not", "Not Compliant"),
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AioaOptions _options;
    private readonly ILogger<AioaService> _logger;

    public AioaService(IHttpClientFactory httpClientFactory, IOptions<AioaOptions> options, ILogger<AioaService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    /* ===================================================================
     * Validation helpers (public: the controller validates inputs too)
     * ================================================================= */

    /// <summary>Normalize user input such as "https://www.Example.com/shop" to "www.example.com".</summary>
    public static string NormalizeDomain(string? value)
    {
        var s = (value ?? string.Empty).Trim().ToLowerInvariant();
        s = SchemeRe.Replace(s, string.Empty);                       // scheme
        var cut = s.IndexOfAny(new[] { '/', '?', '#' });             // path, query, hash
        if (cut >= 0) s = s[..cut];
        s = Regex.Replace(s, @":\d+$", string.Empty);                // port
        return s.Trim('.');
    }

    public static bool IsValidDomain(string domain) => DomainRe.IsMatch(domain);

    public static bool IsValidEmail(string email) => EmailRe.IsMatch(email);

    /* ===================================================================
     * Actions (called from the controller's route endpoint)
     * ================================================================= */

    /// <summary>
    /// Load the widget settings of a domain. Never registers anything: a domain
    /// that is not registered yet answers {"not_registered": true}.
    /// </summary>
    public async Task<JsonObject> FetchWidgetSettingsAsync(string? url, CancellationToken ct = default)
    {
        var domain = NormalizeDomain(url);
        if (!IsValidDomain(domain))
        {
            return Error("A valid domain is required, for example example.com or localhost.");
        }

        var (ok, data) = await GetSettingsDataAsync(domain, ct).ConfigureAwait(false);
        if (!ok)
        {
            return Error("Unable to load widget settings. Please try again.");
        }

        if (data is null)
        {
            return new JsonObject { ["not_registered"] = true };
        }

        return data;
    }

    /// <summary>
    /// Register the free widget for a domain (add-user-domain), then wait for its
    /// settings. widget-settings is checked again first, so a website that is
    /// already registered is never registered twice, and nothing is registered
    /// when the API can't be reached.
    /// </summary>
    public async Task<JsonObject> RegisterDomainAsync(
        string? url, string? username, string? email, string? noRequiredEu, CancellationToken ct = default)
    {
        var domain = NormalizeDomain(url);
        if (!IsValidDomain(domain))
        {
            return Error("A valid domain is required, for example example.com or localhost.");
        }

        var (ok, data) = await GetSettingsDataAsync(domain, ct).ConfigureAwait(false);

        // API not reachable: never register a website that may already be registered
        if (!ok)
        {
            return Error("Unable to load widget settings. Please try again.");
        }

        if (data is null)
        {
            var eu = noRequiredEu == "0" ? "0" : "1";
            await RegisterAsync(domain, username ?? string.Empty, email ?? string.Empty, eu, ct).ConfigureAwait(false);
            data = await WaitForSettingsAsync(domain, ct).ConfigureAwait(false);
        }

        // Registered, but the settings did not appear yet: the page waits instead of registering again
        if (data is null)
        {
            var error = Error("Your website was registered, but its settings are not ready yet. Please try again in a moment.");
            error["pending"] = true;
            return error;
        }

        return data;
    }

    /// <summary>
    /// Dashboard sign-in link of a paid plan: "manage_domain" from check-website.
    /// Only the link is passed on; api_key and the rest stay here.
    /// </summary>
    public async Task<JsonObject> GetDashboardLinkAsync(string? url, CancellationToken ct = default)
    {
        var domain = NormalizeDomain(url);
        if (!IsValidDomain(domain))
        {
            return Error("A valid domain is required, for example example.com or localhost.");
        }

        var res = await PostAsync(AioaOptions.CheckWebsiteApi,
            new Dictionary<string, string> { ["domain"] = domain }, ct).ConfigureAwait(false);
        if (res is null)
        {
            return Error("Unable to load the dashboard link right now.");
        }

        var link = ToStr(res["manage_domain"]);
        if (!link.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return Error("No dashboard link was found for " + domain + ".");
        }

        return new JsonObject { ["link"] = link };
    }

    /// <summary>
    /// Accessibility Score tab: the scan results of a domain, trimmed to what the
    /// score card shows, with Alt Text Remediated from check-website's alt_count.
    /// </summary>
    public async Task<JsonObject> GetScanDetailsAsync(string? url, CancellationToken ct = default)
    {
        var domain = NormalizeDomain(url);
        if (!IsValidDomain(domain))
        {
            return Error("Enter a valid domain, for example example.com or localhost");
        }

        var res = await PostAsync(AioaOptions.ScanApi, new Dictionary<string, string>
        {
            ["lang_code"] = AioaOptions.ScanLang,
            ["website"] = Base64(domain),
        }, ct).ConfigureAwait(false);

        if (res is null)
        {
            return Error("Unable to load the accessibility score right now. Please try again.");
        }

        var data = res["Data"];
        var inProgress = ToInt(res["status"]) == 201;
        if (inProgress || IsEmpty(data) || data is not JsonObject and not JsonArray)
        {
            return new JsonObject
            {
                ["no_scan"] = true,
                ["in_progress"] = inProgress,
                ["message"] = ToStr(res["msg"]),
            };
        }

        // Alt Text Remediated comes from check-website (alt_count)
        var site = await PostAsync(AioaOptions.CheckWebsiteApi,
            new Dictionary<string, string> { ["domain"] = domain }, ct).ConfigureAwait(false);

        var dataObj = data as JsonObject ?? new JsonObject();
        return ScoreSummary(dataObj, site?["alt_count"]);
    }

    /// <summary>
    /// The saved appearance values used by the front-end widget embed
    /// (widget-settings Data), or null when the domain is not registered or the
    /// API is unreachable. The middleware caches the result.
    /// </summary>
    public async Task<EmbedSettings?> GetEmbedSettingsAsync(string? url, CancellationToken ct = default)
    {
        var domain = NormalizeDomain(url);
        if (!IsValidDomain(domain))
        {
            return null;
        }

        var (ok, data) = await GetSettingsDataAsync(domain, ct, mergeMobileFields: false).ConfigureAwait(false);
        if (!ok || data is null)
        {
            return null;
        }

        return new EmbedSettings(
            ToStr(data["widget_color_code"]).TrimStart('#'),
            ToStr(data["widget_position"]),
            ToStr(data["widget_icon_type"]),
            ToStr(data["widget_icon_size"]));
    }

    /* ===================================================================
     * Internal
     * ================================================================= */

    /// <summary>Register the free widget for a domain (add-user-domain).</summary>
    private Task<JsonObject?> RegisterAsync(string url, string name, string email, string noRequiredEu, CancellationToken ct)
    {
        name = name.Trim();
        email = email.Trim();

        var fields = new Dictionary<string, string>
        {
            ["name"] = name.Length > 0 ? name : url,
            ["email"] = IsValidEmail(email) ? email : "no-reply@" + Regex.Replace(url, "^www\\.", string.Empty),
            ["company_name"] = string.Empty,
            ["website"] = Base64(url),
            ["package_type"] = "free-widget",
            // UTC, e.g. 2026-11-02T09:30:00+0000 (matches the reference's start_date)
            ["start_date"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss") + "+0000",
            ["end_date"] = string.Empty,
            ["price"] = string.Empty,
            ["discount_price"] = "0",
            ["platform"] = AioaOptions.Platform,
            ["api_key"] = string.Empty,
            ["is_trial_period"] = string.Empty,
            ["is_free_widget"] = "1",
            ["no_required_eu"] = noRequiredEu,
            ["bill_address"] = string.Empty,
            ["country"] = string.Empty,
            ["state"] = string.Empty,
            ["city"] = string.Empty,
            ["post_code"] = string.Empty,
            ["transaction_id"] = string.Empty,
            ["subscr_id"] = string.Empty,
            ["payment_source"] = string.Empty,
        };

        return ApiPostAsync("add-user-domain", fields, ct);
    }

    /// <summary>
    /// Settings of a registered domain: (true, settings), (true, null) when the
    /// domain is not registered, or (false, null) when the API could not be
    /// reached or did not answer with JSON.
    /// </summary>
    private async Task<(bool Ok, JsonObject? Data)> GetSettingsDataAsync(
        string url, CancellationToken ct, bool mergeMobileFields = true)
    {
        var res = await ApiPostAsync("widget-settings",
            new Dictionary<string, string> { ["website_url"] = url }, ct).ConfigureAwait(false);
        if (res is null)
        {
            return (false, null);
        }

        var data = res["Data"];
        if (IsEmpty(data) || data is not JsonObject obj)
        {
            return (true, null);
        }

        if (mergeMobileFields)
        {
            obj = await WithMobileFieldsAsync(url, obj, ct).ConfigureAwait(false);
        }

        return (true, obj);
    }

    /// <summary>
    /// Add the widget position for mobile (Paid Features) to the settings of a
    /// paid plan. Fields widget-settings already sent win. When the call fails
    /// the settings are returned as they are.
    /// </summary>
    private async Task<JsonObject> WithMobileFieldsAsync(string url, JsonObject data, CancellationToken ct)
    {
        // Same rule as the page: anything but is_free_widget = 1 is a paid plan
        if (ToInt(data["is_free_widget"]) == 1)
        {
            return data;
        }

        var res = await PostAsync(AioaOptions.WidgetSettingsApi,
            new Dictionary<string, string> { ["website_url"] = url }, ct).ConfigureAwait(false);
        if (res?["Data"] is not JsonObject widget)
        {
            return data;
        }

        foreach (var field in MobileFields)
        {
            if (!data.ContainsKey(field) && widget.ContainsKey(field))
            {
                data[field] = widget[field]?.DeepClone();
            }
        }

        return data;
    }

    /// <summary>Poll for the settings of a domain that was just registered.</summary>
    private async Task<JsonObject?> WaitForSettingsAsync(string url, CancellationToken ct, int attempts = 3)
    {
        for (var i = 0; i < attempts; i++)
        {
            await Task.Delay(1000, ct).ConfigureAwait(false);
            var (_, data) = await GetSettingsDataAsync(url, ct).ConfigureAwait(false);
            if (data is not null)
            {
                return data;
            }
        }

        return null;
    }

    /// <summary>
    /// Score card values from the scanner's "Data" (see the reference's
    /// scoreSummary): score 0-99, level/status, violations, alt text, pages,
    /// last scan and the PDF report link.
    /// </summary>
    private static JsonObject ScoreSummary(JsonObject data, JsonNode? altCount)
    {
        // Up to 99, never 100: a scanner score of 100 is shown as 99
        var score = (int)Math.Max(0, Math.Min(99, PhpRound(ToFloat(data["success_percentage"]))));

        var level = ScoreLevels[^1];
        foreach (var candidate in ScoreLevels)
        {
            if (score >= candidate.Min)
            {
                level = candidate;
                break;
            }
        }

        // Every check: fixed by the widget, or still waiting for a manual fix
        var groups = data["acessibility_voilation"] as JsonObject; // API spelling
        var checks = new List<JsonNode?>();
        if (groups?["voilation_remediated"] is JsonArray remediated) checks.AddRange(remediated);
        if (groups?["require_manual_action"] is JsonArray manual) checks.AddRange(manual);

        var fixedCount = 0;
        var total = 0;
        foreach (var check in checks)
        {
            if (check is not JsonObject c)
            {
                continue;
            }
            var checkFixed = ToInt(c["total_fixed"]);
            fixedCount += checkFixed;
            total += checkFixed + ToInt(c["total_error"]);
        }

        // The summary wins when the API sends it
        if (data["summary"] is JsonObject summary
            && summary["total_violations"] is not null
            && summary["total_fixed"] is not null)
        {
            fixedCount = ToInt(summary["total_fixed"]);
            total = ToInt(summary["total_violations"]);
        }

        var reportUrl = ToStr(data["pdf_report_url"]);
        var pagesTotal = data["total_selected_pages"] is not null
            ? ToInt(data["total_selected_pages"])
            : ToInt(data["total_pages"]);

        return new JsonObject
        {
            ["domain"] = ToStr(data["domain"]),
            ["score"] = score,
            ["level"] = level.Level,
            ["status"] = level.Status,
            ["violations"] = Ratio(fixedCount, total),
            ["alt_text"] = AltText(altCount),
            ["pages"] = new JsonObject
            {
                ["scanned"] = ToInt(data["total_scan_pages"]),
                ["total"] = pagesTotal,
            },
            ["last_scan"] = ToStr(data["last_scan"]),
            ["report_url"] = reportUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ? reportUrl : string.Empty,
        };
    }

    /// <summary>
    /// Alt Text Remediated from check-website's alt_count: fixed = decorative +
    /// update alt text + other images; total = fixed + missing alt tag.
    /// </summary>
    private static JsonObject AltText(JsonNode? altCount)
    {
        var count = altCount as JsonObject ?? new JsonObject();
        int Images(string key) => Math.Max(0, ToInt(count[key]));

        var fixedCount = Images("total_decorative_images") + Images("total_update_alt_text") + Images("total_other_images");
        return Ratio(fixedCount, fixedCount + Images("total_missing_alt_tag"));
    }

    /// <summary>{"fixed": 38, "total": 44, "percentage": 86.36}</summary>
    private static JsonObject Ratio(int fixedCount, int total) => new()
    {
        ["fixed"] = fixedCount,
        ["total"] = total,
        ["percentage"] = total > 0 ? PhpRound(fixedCount / (double)total * 100, 2) : 0,
    };

    private static JsonObject Error(string message) => new() { ["error"] = message };

    /* ---------- HTTP ---------- */

    /// <summary>POST form fields to a Skynet API endpoint (relative to ApiBase).</summary>
    private Task<JsonObject?> ApiPostAsync(string endpoint, IDictionary<string, string> fields, CancellationToken ct)
        => PostAsync(AioaOptions.ApiBase + endpoint, fields, ct);

    /// <summary>
    /// POST form fields to a URL and decode the JSON answer: the decoded object
    /// (also for 4xx answers with a JSON body), or null on a network / JSON
    /// error. Redirects are not followed; TLS certificates are verified.
    /// </summary>
    private async Task<JsonObject?> PostAsync(string url, IDictionary<string, string> fields, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var content = new FormUrlEncodedContent(fields);
            using var response = await client.PostAsync(url, content, ct).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            return JsonNode.Parse(body) as JsonObject;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "AIOA call to {Url} failed.", url);
            return null; // network error, timeout or not JSON
        }
    }

    /* ---------- Small conversions (API values may be numbers, numeric strings or null) ---------- */

    internal static double ToFloat(JsonNode? value)
    {
        switch (value)
        {
            case null:
                return 0;
            case JsonValue v:
                if (v.TryGetValue<bool>(out var b)) return b ? 1 : 0;
                if (v.TryGetValue<double>(out var d)) return double.IsFinite(d) ? d : 0;
                if (v.TryGetValue<string>(out var s))
                {
                    var match = Regex.Match(s, @"^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?");
                    return match.Success && double.TryParse(match.Value,
                        System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
                }
                return 0;
            default:
                return 0;
        }
    }

    internal static int ToInt(JsonNode? value)
    {
        var number = ToFloat(value);
        return double.IsFinite(number) ? (int)Math.Truncate(number) : 0;
    }

    internal static string ToStr(JsonNode? value)
    {
        if (value is not JsonValue v)
        {
            return string.Empty; // null, objects and arrays
        }
        if (v.TryGetValue<bool>(out var b))
        {
            return b ? "1" : string.Empty; // true -> "1", false -> ""
        }
        if (v.TryGetValue<string>(out var s))
        {
            return s;
        }
        return v.ToJsonString().Trim('"');
    }

    /// <summary>Empty like PHP's empty(): missing, null, false, 0, "", "0", [] or {}.</summary>
    internal static bool IsEmpty(JsonNode? value)
    {
        switch (value)
        {
            case null:
                return true;
            case JsonObject o:
                return o.Count == 0;
            case JsonArray a:
                return a.Count == 0;
            case JsonValue v:
                if (v.TryGetValue<bool>(out var b)) return !b;
                if (v.TryGetValue<double>(out var d)) return d == 0;
                if (v.TryGetValue<string>(out var s)) return s is "" or "0";
                return false;
            default:
                return false;
        }
    }

    /// <summary>Round half away from zero, like PHP's round().</summary>
    internal static double PhpRound(double value, int precision = 0)
        => Math.Round(value, precision, MidpointRounding.AwayFromZero);

    private static string Base64(string value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(value));
}

/// <summary>Saved appearance values used to build the front-end embed URL.</summary>
public sealed record EmbedSettings(string ColorCode, string Position, string IconType, string IconSize);
