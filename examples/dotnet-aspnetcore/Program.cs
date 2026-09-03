using Prauga.FlexDoc.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/openapi.json", () => Results.Json(new
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
}));

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapFlexDoc(options =>
{
    options.Path = "/docs";
    options.SpecUrl = "/openapi.json";
    options.Title = "FlexDoc ASP.NET Core Example";
});

app.Run();
