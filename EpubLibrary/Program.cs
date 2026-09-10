using EpubLibrary.Services;
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<IMyLibraryService, MyLibraryService>();
builder.Services.AddSingleton<PiperTtsService>();
builder.Services.AddSingleton<ITtsEngine>(services => services.GetRequiredService<PiperTtsService>());
builder.Services.AddHttpClient<KokoroTtsService>();
builder.Services.AddSingleton<ITtsEngine>(services => services.GetRequiredService<KokoroTtsService>());
builder.Services.AddSingleton<ITtsService, TtsService>();
builder.Services.AddHostedService<KokoroProcessHostedService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
            policy.WithOrigins(
                    "http://localhost:3000",
                    "http://localhost:3001",
                    "http://localhost:3002",
                    "http://localhost:3005",
                    "http://127.0.0.1:3005",
                    "http://127.0.0.1:3101")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("AllowFrontend");

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

app.Run();
