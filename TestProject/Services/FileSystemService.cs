using System.Runtime.InteropServices;
using Microsoft.Extensions.Options;
using FileExplorer.Models;
using FileExplorer.Services.Interfaces;


namespace FileExplorer.Services;

public class FileSystemService : IFileSystemService
{
    private readonly string _homeDirectory;
    private readonly StringComparison _pathComparison;
    private readonly ILogger<FileSystemService> _logger;


    public FileSystemService(IOptions<FileExplorerOptions> options, ILogger<FileSystemService> logger)
    {
        _logger = logger;

        var absolute = Path.GetFullPath(options.Value.HomeDirectory);

        _homeDirectory = absolute.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                         + Path.DirectorySeparatorChar;

        _pathComparison = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;

        Directory.CreateDirectory(absolute);
        _logger.LogInformation("File Explorer home: {Home}", _homeDirectory);
    }

    public string ResolvePath(string? relativePath)
    {
        var normalised = string.IsNullOrWhiteSpace(relativePath)
            ? string.Empty
            : relativePath.Trim('/', '\\');

        var homeDirNoTrail = _homeDirectory.TrimEnd(Path.DirectorySeparatorChar);

        var absolute = string.IsNullOrEmpty(normalised)
            ? homeDirNoTrail
            : Path.GetFullPath(Path.Combine(homeDirNoTrail, normalised));

        var candidateWithTrail = absolute.TrimEnd(Path.DirectorySeparatorChar)
                                 + Path.DirectorySeparatorChar;

        var isContained = candidateWithTrail.StartsWith(_homeDirectory, _pathComparison)
                          || string.Equals(absolute, homeDirNoTrail, _pathComparison);

        if (!isContained)
        {
            _logger.LogWarning(
                "Path traversal blocked — raw: {Raw}  resolved: {Resolved}",
                relativePath, absolute);

            throw new UnauthorizedAccessException(
                "Access outside the home directory is not permitted.");
        }

        return absolute;
    }

    public string ToRelativePath(string absolute)
    {
        var rel = Path.GetRelativePath(
            _homeDirectory.TrimEnd(Path.DirectorySeparatorChar),
            absolute);

        return rel == "." ? string.Empty : rel.Replace('\\', '/');
    }

    public BrowseResult Browse(string? path)
    {
        var absolute = ResolvePath(path);

        if (!Directory.Exists(absolute))
        {
            throw new DirectoryNotFoundException($"Directory not found: {path}");
        }

        var dir = new DirectoryInfo(absolute);
        var entries = new List<FileSystemEntry>();

        // Directories first — users expect folders at the top of any file browser.
        // Both groups are sorted alphabetically (case-insensitive) within themselves.
        foreach (var sub in dir.EnumerateDirectories()
                               .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
        {
            entries.Add(BuildEntry(sub));
        }

        foreach (var file in dir.EnumerateFiles()
                                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase))
        {
            entries.Add(BuildEntry(file));
        }

        return new BrowseResult(
            RequestedPath: ToRelativePath(absolute),
            Entries: entries,
            FileCount: entries.Count(e => !e.IsDirectory),
            FolderCount: entries.Count(e => e.IsDirectory),
            TotalSize: entries.Where(e => !e.IsDirectory).Sum(e => e.Size));
    }

    public SearchResult Search(string? path, string query)
    {
        var searchRoot = ResolvePath(path);

        if (!Directory.Exists(searchRoot))
            throw new DirectoryNotFoundException($"Search root not found: {path}");

        const int maxResults = 500;

        var opts = new EnumerationOptions
        {
            RecurseSubdirectories = true,
            IgnoreInaccessible = true,      // skip files we can't read rather than throwing
            MatchCasing = MatchCasing.CaseInsensitive
        };

        var hits = new DirectoryInfo(searchRoot)
            .EnumerateFileSystemInfos($"*{query}*", opts)
            .Take(maxResults + 1)
            .ToList();

        var isTruncated = hits.Count > maxResults;

        if (isTruncated)
        {
            hits = [.. hits.Take(maxResults)];
        }

        return new SearchResult(
            Query: query,
            SearchRoot: ToRelativePath(searchRoot),
            Results: hits.Select(BuildEntry).ToList(),
            TotalFound: hits.Count,
            IsTruncated: isTruncated);
    }

    public async Task<List<FileSystemEntry>> UploadAsync(string? directoryPath, IList<IFormFile> files)
    {
        var targetDir = ResolvePath(directoryPath);

        if (!Directory.Exists(targetDir))
        {
            throw new DirectoryNotFoundException($"Target directory not found: {directoryPath}");
        }

        var uploaded = new List<FileSystemEntry>();

        foreach (var formFile in files)
        {
            if (formFile.Length == 0) continue;

            var fileName = Path.GetFileName(formFile.FileName);

            if (string.IsNullOrWhiteSpace(fileName)) continue;

            var destAbsolute = Path.GetFullPath(Path.Combine(targetDir, fileName));

            if (!destAbsolute.StartsWith(
                    _homeDirectory.TrimEnd(Path.DirectorySeparatorChar), _pathComparison))
            {
                throw new UnauthorizedAccessException("Invalid upload filename.");
            }

            await using var stream = new FileStream(
                destAbsolute, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 81920);

            await formFile.CopyToAsync(stream);

            uploaded.Add(BuildEntry(new FileInfo(destAbsolute)));
        }

        return uploaded;
    }

    public void Delete(string path)
    {
        var absolute = ResolvePath(path);

        if (Directory.Exists(absolute))
        {
            Directory.Delete(absolute, recursive: true);

            return;
        }

        if (File.Exists(absolute))
        {
            File.Delete(absolute);

            return;
        }

        throw new FileNotFoundException($"Path not found: {path}");
    }

    public void Move(string sourcePath, string destinationPath)
    {
        var src = ResolvePath(sourcePath);
        var dest = ResolvePath(destinationPath);

        if (Directory.Exists(src))
        {
            Directory.Move(src, dest);
        }
        else if (File.Exists(src))
        {
            File.Move(src, dest, overwrite: false);
        }
        else
        {
            throw new FileNotFoundException($"Source not found: {sourcePath}");
        }
    }

    public void Copy(string sourcePath, string destinationPath)
    {
        var src = ResolvePath(sourcePath);
        var dest = ResolvePath(destinationPath);

        if (Directory.Exists(src))
        {
            CopyDirectoryRecursive(src, dest);
        }
        else if (File.Exists(src))
        {
            File.Copy(src, dest, overwrite: false);
        }
        else
        {
            throw new FileNotFoundException($"Source not found: {sourcePath}");
        }
    }

    public FileSystemEntry MakeDirectory(string path, string name)
    {
        var parentAbsolute = ResolvePath(path);

        if (!Directory.Exists(parentAbsolute))
        {
            throw new DirectoryNotFoundException($"Parent directory not found: {path}");
        }

        var folderName = Path.GetFileName(name?.Trim() ?? string.Empty);

        if (string.IsNullOrWhiteSpace(folderName))
        {
            throw new ArgumentException("Folder name cannot be empty.");
        }

        if (folderName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            throw new ArgumentException(
                $"Folder name '{folderName}' contains invalid characters.");
        }

        var newDirAbsolute = Path.GetFullPath(Path.Combine(parentAbsolute, folderName));

        if (!newDirAbsolute.StartsWith(
                _homeDirectory.TrimEnd(Path.DirectorySeparatorChar), _pathComparison))
        {
            throw new UnauthorizedAccessException("Forbidden.");
        }

        if (Directory.Exists(newDirAbsolute))
        {
            throw new IOException($"A directory named '{folderName}' already exists.");
        }

        Directory.CreateDirectory(newDirAbsolute);

        return BuildEntry(new DirectoryInfo(newDirAbsolute));
    }


    #region Private Methods

    private FileSystemEntry BuildEntry(FileSystemInfo info)
    {
        if (info is DirectoryInfo dir)
        {
            var childCount = 0;

            try
            { 
                childCount = dir.EnumerateFileSystemInfos().Count(); 
            }
            catch (UnauthorizedAccessException) 
            { 
                /* skip inaccessible directories */ 
            }

            return new FileSystemEntry(
                Name: dir.Name,
                RelativePath: ToRelativePath(dir.FullName),
                IsDirectory: true,
                Size: 0,
                LastModified: dir.LastWriteTimeUtc,
                Extension: string.Empty,
                ChildCount: childCount);
        }

        if (info is FileInfo file)
        {
            return new FileSystemEntry(
                Name: file.Name,
                RelativePath: ToRelativePath(file.FullName),
                IsDirectory: false,
                Size: file.Length,
                LastModified: file.LastWriteTimeUtc,
                Extension: file.Extension.TrimStart('.').ToLowerInvariant(),
                ChildCount: null);
        }

        throw new ArgumentException($"Unsupported FileSystemInfo type: {info.GetType().Name}");
    }

    private static void CopyDirectoryRecursive(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var filePath in Directory.EnumerateFiles(source))
        {
            File.Copy(filePath, Path.Combine(destination, Path.GetFileName(filePath)), overwrite: false);
        }

        foreach (var dirPath in Directory.EnumerateDirectories(source))
        {
            CopyDirectoryRecursive(dirPath, Path.Combine(destination, Path.GetFileName(dirPath)));
        }
    }

    #endregion
}
