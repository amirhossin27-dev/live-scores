[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$iconOutput = Join-Path $iconProjectRoot 'public\icons'
$iconMaster = [System.Drawing.Image]::FromFile((Join-Path $iconProjectRoot 'docs\branding\live-scores-tempo-master.png'))
$iconSizes = [ordered]@{
    'favicon-16.png' = 16
    'favicon-32.png' = 32
    'favicon-48.png' = 48
    'apple-touch-icon.png' = 180
    'icon-192.png' = 192
    'icon-512.png' = 512
}

try {
    foreach ($iconEntry in $iconSizes.GetEnumerator()) {
        $iconSize = [int]$iconEntry.Value
        $iconBitmap = [System.Drawing.Bitmap]::new($iconSize, $iconSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
        $iconAttributes = [System.Drawing.Imaging.ImageAttributes]::new()
        try {
            $iconGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $iconAttributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $iconRect = [System.Drawing.Rectangle]::new(0, 0, $iconSize, $iconSize)
            $iconGraphics.DrawImage($iconMaster, $iconRect, 0, 0, $iconMaster.Width, $iconMaster.Height, [System.Drawing.GraphicsUnit]::Pixel, $iconAttributes)
            $iconBitmap.Save((Join-Path $iconOutput $iconEntry.Key), [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $iconAttributes.Dispose()
            $iconGraphics.Dispose()
            $iconBitmap.Dispose()
        }
        Write-Output ('{0}: {1}x{1}' -f $iconEntry.Key, $iconSize)
    }
}
finally { $iconMaster.Dispose() }

# Modern ICO: three PNG frames with an explicit 16/32/48 px directory.
$iconFrames = @(16, 32, 48 | ForEach-Object {
    [pscustomobject]@{ Size = $_; Bytes = [System.IO.File]::ReadAllBytes((Join-Path $iconOutput ('favicon-{0}.png' -f $_))) }
})
$iconStream = [System.IO.File]::Create((Join-Path $iconOutput 'favicon.ico'))
$iconWriter = [System.IO.BinaryWriter]::new($iconStream)
try {
    $iconWriter.Write([uint16]0)
    $iconWriter.Write([uint16]1)
    $iconWriter.Write([uint16]$iconFrames.Count)
    $iconOffset = 6 + 16 * $iconFrames.Count
    foreach ($iconFrame in $iconFrames) {
        $iconWriter.Write([byte]$iconFrame.Size)
        $iconWriter.Write([byte]$iconFrame.Size)
        $iconWriter.Write([byte]0)
        $iconWriter.Write([byte]0)
        $iconWriter.Write([uint16]1)
        $iconWriter.Write([uint16]24)
        $iconWriter.Write([uint32]$iconFrame.Bytes.Length)
        $iconWriter.Write([uint32]$iconOffset)
        $iconOffset += $iconFrame.Bytes.Length
    }
    foreach ($iconFrame in $iconFrames) { $iconWriter.Write([byte[]]$iconFrame.Bytes) }
}
finally { $iconWriter.Dispose() }
Write-Output 'favicon.ico: 16/32/48 px'