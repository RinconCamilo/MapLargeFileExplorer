namespace FileExplorer.Models;

public class FileExplorerOptions
{
    /// <summary>
    /// The key used in appsettings.json, e.g.
    ///   "FileExplorer": { "HomeDirectory": "C:\\Files" }
    /// </summary>
    public const string SectionName = "FileExplorer";

    /// <summary>
    /// Root directory exposed by the API.  Relative paths are resolved from
    /// the application's working directory.
    /// </summary>
    public string HomeDirectory { get; set; } = "HomeDirectory";
}
