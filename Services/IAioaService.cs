using System.Text.Json.Nodes;

namespace AllinOneAccessibility.Services;

/// <summary>
/// Server-side gateway to the Skynet Technologies "All in One Accessibility"
/// API: the four settings-page actions plus the appearance values used by the
/// front-end widget embed. See <see cref="AioaService"/> for semantics.
/// </summary>
public interface IAioaService
{
    /// <summary>Route action "fetchWidgetSettings" (never registers).</summary>
    Task<JsonObject> FetchWidgetSettingsAsync(string? url, CancellationToken ct = default);

    /// <summary>Route action "registerDomain" (registers the free widget once).</summary>
    Task<JsonObject> RegisterDomainAsync(string? url, string? username, string? email, string? noRequiredEu, CancellationToken ct = default);

    /// <summary>Route action "getDashboardLink" (paid plans).</summary>
    Task<JsonObject> GetDashboardLinkAsync(string? url, CancellationToken ct = default);

    /// <summary>Route action "fetchScanDetails" (Accessibility Score tab).</summary>
    Task<JsonObject> GetScanDetailsAsync(string? url, CancellationToken ct = default);

    /// <summary>Appearance values for the widget embed, or null when unregistered/unreachable.</summary>
    Task<EmbedSettings?> GetEmbedSettingsAsync(string? url, CancellationToken ct = default);
}
