[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'
$maxBytes = 50 * 1024
$allowedExtensions = @('.png', '.jpg', '.jpeg')
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$file = Get-Item -LiteralPath $resolvedPath

if ($file.PSIsContainer) {
    throw "Path must point to an image file: $resolvedPath"
}

$extension = $file.Extension.ToLowerInvariant()
if ($allowedExtensions -notcontains $extension) {
    throw "Unsupported image format '$extension'. Use PNG, JPG, or JPEG."
}

$result = [ordered]@{
    path = $file.FullName
    extension = $extension
    bytes = $file.Length
    kibibytes = [Math]::Round($file.Length / 1KB, 2)
    maxBytes = $maxBytes
    withinLimit = ($file.Length -le $maxBytes)
}

$result | ConvertTo-Json -Compress

if (-not $result.withinLimit) {
    exit 2
}
