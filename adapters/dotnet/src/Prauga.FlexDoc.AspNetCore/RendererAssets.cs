using System.Reflection;
using System.Security.Cryptography;

namespace Prauga.FlexDoc.AspNetCore;

internal static class RendererAssets
{
    private const string JsResource = "Prauga.FlexDoc.AspNetCore.Assets.flexdoc.standalone.js";
    private const string CssResource = "Prauga.FlexDoc.AspNetCore.Assets.flexdoc.standalone.css";

    private static readonly Lazy<byte[]> Js = new(() => Read(JsResource));
    private static readonly Lazy<byte[]> Css = new(() => Read(CssResource));
    private static readonly Lazy<string> FingerprintValue = new(CreateFingerprint);

    internal static ReadOnlyMemory<byte> JavaScript => Js.Value;
    internal static ReadOnlyMemory<byte> CssText => Css.Value;
    internal static string Fingerprint => FingerprintValue.Value;

    private static byte[] Read(string resourceName)
    {
        var assembly = typeof(RendererAssets).Assembly;
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Missing embedded FlexDoc renderer resource: {resourceName}");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }

    private static string CreateFingerprint()
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Js.Value);
        hash.AppendData(new byte[] { 0 });
        hash.AppendData(Css.Value);
        var digest = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        return digest[..16];
    }
}
