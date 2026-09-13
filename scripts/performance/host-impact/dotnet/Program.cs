using Prauga.FlexDoc.AspNetCore;

var mode = Environment.GetEnvironmentVariable("FLEXDOC_BENCH_MODE") ?? "baseline";
var port = int.TryParse(Environment.GetEnvironmentVariable("FLEXDOC_BENCH_PORT"), out var parsedPort) ? parsedPort : 5810;
var listenOrigin = $"http://127.0.0.1:{port}";
var targetOrigin = Environment.GetEnvironmentVariable("FLEXDOC_BENCH_ORIGIN") ?? listenOrigin;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(listenOrigin);
var app = builder.Build();

var spec = new
{
    openapi = "3.0.3",
    info = new { title = "FlexDoc host-impact benchmark", version = "1.0.0" },
    paths = new Dictionary<string, object>
    {
        ["/target"] = new
        {
            get = new
            {
                responses = new Dictionary<string, object>
                {
                    ["200"] = new { description = "ok" },
                },
            },
        },
    },
};

app.MapGet("/health", () => Results.Json(new { ok = true }));
app.MapGet("/target", () => Results.Json(new { ok = true, runtime = "dotnet-aspnetcore" }));
app.MapGet("/openapi.json", () => Results.Json(spec));

if (mode != "baseline")
{
    FlexDocHostExecution? executor = mode == "host" ? new FlexDocHostExecution(new[] { targetOrigin }) : null;
    app.MapFlexDoc(options =>
    {
        options.Path = "/docs";
        options.SpecUrl = "/openapi.json";
        options.Title = "FlexDoc host-impact benchmark";
        options.TryItEnabled = true;
        options.TryItDefaultServer = targetOrigin;
        if (executor is not null)
        {
            options.TryItHostExecution = true;
            options.HostExecution = executor;
        }
    });
}

app.Run();
