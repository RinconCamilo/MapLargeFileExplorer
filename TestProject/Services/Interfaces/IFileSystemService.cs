using FileExplorer.Models;


namespace FileExplorer.Services.Interfaces;

public interface IFileSystemService
{
    /// <summary>
    /// Resolves a client-supplied relative path to an absolute path that is
    /// guaranteed to lie within the configured home directory.
    /// </summary>
    /// <exception cref="UnauthorizedAccessException">
    /// Thrown when the resolved path escapes the home directory (path traversal).
    /// </exception>
    string ResolvePath(string? relativePath);

    /// <summary>Converts an absolute path back to a forward-slash relative path.</summary>
    string ToRelativePath(string absolutePath);

    /// <summary>
    /// Lists the contents of a directory.  Directories are returned before
    /// files; both groups are sorted alphabetically.
    /// </summary>
    /// <exception cref="DirectoryNotFoundException">The path does not exist.</exception>
    /// <exception cref="UnauthorizedAccessException">Path traversal attempt.</exception>
    BrowseResult Browse(string? path);

    /// <summary>
    /// Recursively searches for items whose names contain <paramref name="query"/>.
    /// Results are capped at 500 to prevent unbounded enumeration.
    /// </summary>
    /// <exception cref="DirectoryNotFoundException">The search root does not exist.</exception>
    SearchResult Search(string? path, string query);

    /// <summary>Writes uploaded files to the specified directory.</summary>
    Task<List<FileSystemEntry>> UploadAsync(string? directoryPath, IList<IFormFile> files);

    /// <summary>
    /// Deletes a file, or recursively deletes a directory.
    /// </summary>
    /// <exception cref="FileNotFoundException">The path does not exist.</exception>
    void Delete(string path);

    /// <summary>
    /// Moves or renames a file or directory.
    /// </summary>
    /// <exception cref="FileNotFoundException">Source does not exist.</exception>
    /// <exception cref="IOException">Destination already exists.</exception>
    void Move(string sourcePath, string destinationPath);

    /// <summary>
    /// Copies a file, or recursively copies a directory tree.
    /// </summary>
    /// <exception cref="FileNotFoundException">Source does not exist.</exception>
    void Copy(string sourcePath, string destinationPath);

    /// <summary>
    /// Creates a new directory inside <paramref name="path"/>.
    /// </summary>
    /// <exception cref="ArgumentException">Name is empty or contains invalid characters.</exception>
    /// <exception cref="IOException">A directory with that name already exists.</exception>
    FileSystemEntry MakeDirectory(string path, string name);
}
