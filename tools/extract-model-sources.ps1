$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $workspace 'assets-source'
$targetRoot = Join-Path $workspace '.local-tools/model-sources'
function Expand-CheckedArchive([string]$archivePath, [string]$destination) {
    $absolute = [IO.Path]::GetFullPath($destination)
    if (!$absolute.StartsWith($targetRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Extraction outside inspection root' }
    [IO.Directory]::CreateDirectory($absolute) | Out-Null
    $zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        if ($zip.Entries.Count -gt 10000) { throw 'Too many entries' }
        if (($zip.Entries | Measure-Object Length -Sum).Sum -gt 1GB) { throw 'Archive exceeds inspection budget' }
        foreach ($entry in $zip.Entries) {
            if ($entry.Length -gt 500MB) { throw 'Entry exceeds inspection budget' }
            $unixType = ($entry.ExternalAttributes -shr 16) -band 0xF000
            if ($unixType -eq 0xA000) { throw 'Symlink entry rejected' }
            $path = [IO.Path]::GetFullPath((Join-Path $absolute $entry.FullName))
            if (!$path.StartsWith($absolute + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe path: $($entry.FullName)" }
            if ($entry.FullName.EndsWith('/')) { [IO.Directory]::CreateDirectory($path) | Out-Null; continue }
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path)) | Out-Null
            if (![IO.File]::Exists($path)) { [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $path, $false) }
        }
    } finally { $zip.Dispose() }
}
foreach ($package in Get-ChildItem -LiteralPath $sourceRoot -Filter '*.zip') {
    $destination = Join-Path $targetRoot $package.BaseName
    Expand-CheckedArchive $package.FullName $destination
    foreach ($nested in Get-ChildItem -LiteralPath $destination -Recurse -Filter '*.zip') {
        Expand-CheckedArchive $nested.FullName (Join-Path $nested.DirectoryName ($nested.BaseName + '-expanded'))
    }
}
Get-ChildItem -LiteralPath $targetRoot -Recurse -File | Where-Object Extension -Match '^\.(fbx|dae|obj|blend|glb|gltf)$' | Select-Object FullName,Length | ConvertTo-Json
