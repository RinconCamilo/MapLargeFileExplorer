using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using FileExplorer.Models;
using FileExplorer.Services.Interfaces;


namespace FileExplorer.Controllers;

[ApiController]
[Route("api/fs")]
public class FileSystemController(
    IFileSystemService fs, 
    ILogger<FileSystemController> logger) : ControllerBase
{
    private readonly IFileSystemService _fs = fs;
    private readonly ILogger<FileSystemController> _logger = logger;
    private readonly FileExtensionContentTypeProvider _contentTypes = new();


    [HttpGet("browse")]
    public ActionResult<BrowseResult> Browse([FromQuery] string? path)
    {
        try
        {
            return Ok(_fs.Browse(path));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Directory not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error browsing {Path}", path);
            return StatusCode(500, new ErrorResponse("Internal error", ex.Message));
        }
    }

    [HttpGet("search")]
    public ActionResult<SearchResult> Search([FromQuery] string? path, [FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new ErrorResponse("'query' parameter is required"));
        }

        try
        {
            return Ok(_fs.Search(path, query));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Search root not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching '{Query}' in {Path}", query, path);
            return StatusCode(500, new ErrorResponse("Internal error", ex.Message));
        }
    }

    [HttpGet("download")]
    public IActionResult Download([FromQuery] string path)
    {
        try
        {
            var absolute = _fs.ResolvePath(path);

            if (!System.IO.File.Exists(absolute))
            {
                return NotFound(new ErrorResponse("File not found", path));
            }

            if (!_contentTypes.TryGetContentType(absolute, out var mime))
            {
                mime = "application/octet-stream";
            }

            return PhysicalFile(absolute, mime, Path.GetFileName(absolute), enableRangeProcessing: true);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading {Path}", path);
            return StatusCode(500, new ErrorResponse("Download failed", ex.Message));
        }
    }

    [HttpPost("upload")]
    [RequestSizeLimit(500_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 500_000_000)]
    public async Task<ActionResult<List<FileSystemEntry>>> Upload(
        [FromQuery] string? path,
        IList<IFormFile> files)
    {
        if (files == null || files.Count == 0)
        {
            return BadRequest(new ErrorResponse("No files provided"));
        }

        try
        {
            return Ok(await _fs.UploadAsync(path, files));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Target directory not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading to {Path}", path);
            return StatusCode(500, new ErrorResponse("Upload failed", ex.Message));
        }
    }

    [HttpDelete("item")]
    public IActionResult Delete([FromQuery] string path)
    {
        try
        {
            _fs.Delete(path);

            return Ok(new { message = "Deleted", path });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Path not found", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting {Path}", path);
            return StatusCode(500, new ErrorResponse("Delete failed", ex.Message));
        }
    }

    [HttpPost("move")]
    public IActionResult Move([FromBody] MoveRequest request)
    {
        try
        {
            _fs.Move(request.SourcePath, request.DestinationPath);

            return Ok(new { message = "Moved", from = request.SourcePath, to = request.DestinationPath });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Source not found", ex.Message));
        }
        catch (IOException ex)
        {
            return StatusCode(409, new ErrorResponse("Move failed — destination may already exist", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving {Src} to {Dest}", request.SourcePath, request.DestinationPath);
            return StatusCode(500, new ErrorResponse("Move failed", ex.Message));
        }
    }

    [HttpPost("copy")]
    public IActionResult Copy([FromBody] MoveRequest request)
    {
        try
        {
            _fs.Copy(request.SourcePath, request.DestinationPath);

            return Ok(new { message = "Copied", from = request.SourcePath, to = request.DestinationPath });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Source not found", ex.Message));
        }
        catch (IOException ex)
        {
            return StatusCode(409, new ErrorResponse("Copy failed — destination may already exist", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error copying {Src} to {Dest}", request.SourcePath, request.DestinationPath);
            return StatusCode(500, new ErrorResponse("Copy failed", ex.Message));
        }
    }

    [HttpPost("mkdir")]
    public ActionResult<FileSystemEntry> MakeDirectory([FromBody] MkdirRequest request)
    {
        try
        {
            return Ok(_fs.MakeDirectory(request.Path, request.Name));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new ErrorResponse("Forbidden", ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ErrorResponse("Invalid folder name", ex.Message));
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new ErrorResponse("Parent directory not found", ex.Message));
        }
        catch (IOException ex)
        {
            return Conflict(new ErrorResponse("Directory already exists", ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating directory '{Name}' in {Path}", request.Name, request.Path);
            return StatusCode(500, new ErrorResponse("Failed to create directory", ex.Message));
        }
    }
}
