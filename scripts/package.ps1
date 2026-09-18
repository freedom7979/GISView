$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$releasePath = Join-Path $projectRoot 'release'
if (-not (Test-Path -LiteralPath (Join-Path $distPath 'index.html'))) { throw 'Nejprve spusťte npm run build.' }
New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
$archivePath = Join-Path $releasePath 'gisview-dist.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($asset in (Get-ChildItem -LiteralPath $distPath -Recurse -File)) {
    # Forward slashes are required for portable extraction on Linux hosting.
    $entryName = $asset.FullName.Substring($distPath.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $asset.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
Write-Output "Distribution archive: $archivePath"
