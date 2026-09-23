using Prauga.FlexDoc.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var openApiDocument = new
{
    openapi = "3.0.3",
    info = new { title = "FlexDoc ASP.NET Core Example", version = "1.0.0" },
    paths = new Dictionary<string, object>
    {
        ["/health"] = new
        {
            get = new
            {
                summary = "Health check",
                responses = new Dictionary<string, object>
                {
                    ["200"] = new { description = "Healthy" },
                },
            },
        },
    },
};

app.MapGet("/openapi.json", () => Results.Json(openApiDocument));
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/internal/health", () => Results.Ok(new { status = "internal-ok" }));
app.MapPost("/internal/reindex", () => Results.Ok(new { accepted = true }));
app.MapFlexDoc(options =>
{
    options.Path = "/docs";
    options.SpecUrl = "/openapi.json";
    options.Title = "FlexDoc ASP.NET Core Example";
    options.RuntimeIntelligence = true;
    options.RuntimeOpenApiDocument = openApiDocument;
    options.AcknowledgedUndocumented = new[]
    {
        new FlexDocAcknowledgedRoute { Method = "GET", Path = "/internal/health" },
    };
});

app.Run();
