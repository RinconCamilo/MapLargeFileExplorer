namespace FileExplorer.Models;

/// <summary>
/// Represents a single file or directory returned by the browse/search API.
/// Sent to the client as JSON; the frontend uses this shape directly.
/// </summary>
public record FileSystemEntry(
    /// <summary>Bare file or directory name (no path prefix).</summary>
    string Name,

    /// <summary>
    /// Path relative to the configured home directory, using forward slashes.
    /// An empty string means the home directory root itself.
    /// </summary>
    string RelativePath,

    /// <summary>True for directories, false for files.</summary>
    bool IsDirectory,

    /// <summary>
    /// File size in bytes. Always 0 for directories; computing a directory's
    /// recursive size on every listing would be prohibitively expensive for
    /// large trees and is done on demand instead.
    /// </summary>
    long Size,

    /// <summary>UTC last-write timestamp.</summary>
    DateTime LastModified,

    /// <summary>Lowercase extension without the leading dot (e.g. "pdf"). Empty for directories.</summary>
    string Extension,

    /// <summary>
    /// Number of immediate children (files + subdirectories).
    /// Null for file entries. Lets the UI show "(12 items)" badges without
    /// an extra round-trip.
    /// </summary>
    int? ChildCount
);

/// <summary>
/// Full result of a directory browse operation, including aggregate statistics
/// that the UI displays in the stats bar.
/// </summary>
public record BrowseResult(
    /// <summary>Relative path that was actually browsed (normalised from the request).</summary>
    string RequestedPath,

    /// <summary>All entries in the directory, directories first, sorted by name.</summary>
    IReadOnlyList<FileSystemEntry> Entries,

    /// <summary>Number of file entries (not directories) in this directory.</summary>
    int FileCount,

    /// <summary>Number of subdirectory entries in this directory.</summary>
    int FolderCount,

    /// <summary>Sum of all file sizes in bytes (non-recursive — current directory only).</summary>
    long TotalSize
);

/// <summary>
/// Result of a recursive search operation. Capped at 500 results to prevent
/// runaway enumeration on large directory trees.
/// </summary>
public record SearchResult(
    string Query,
    string SearchRoot,
    IReadOnlyList<FileSystemEntry> Results,
    int TotalFound,

    /// <summary>True when results were truncated at the cap.</summary>
    bool IsTruncated
);

/// <summary>Request body used for both move and copy operations.</summary>
public record MoveRequest(
    string SourcePath,
    string DestinationPath
);

/// <summary>Request body for creating a new directory.</summary>
public record MkdirRequest(
    /// <summary>Parent directory (relative path).</summary>
    string Path,
    /// <summary>Name of the new directory (not a full path — just the folder name).</summary>
    string Name
);

/// <summary>Standard error envelope returned for all non-2xx responses.</summary>
public record ErrorResponse(string Error, string? Detail = null);
