using Microsoft.AspNetCore.Http.Features;
using FileExplorer.Models;
using FileExplorer.Services;
using FileExplorer.Services.Interfaces;


var builder = WebApplication.CreateBuilder(args);


builder.Services.Configure<FileExplorerOptions>(
    builder.Configuration.GetSection(FileExplorerOptions.SectionName));


builder.Services.AddScoped<IFileSystemService, FileSystemService>();


builder.Services.AddControllers();


builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 500_000_000; // 500 MB
});

builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 500_000_000; // 500 MB
});


var app = builder.Build();


app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.MapFallbackToFile("index.html");


app.Run();