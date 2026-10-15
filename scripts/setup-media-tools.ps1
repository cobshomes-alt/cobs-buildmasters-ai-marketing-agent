$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.tools\ffmpeg'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
$downloadRoot = Join-Path $toolsRoot ('download-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $downloadRoot | Out-Null
$archive = Join-Path $downloadRoot 'ffmpeg.zip'
# Official FFmpeg download page links this Windows vendor. Pinned GPLv3 build.
Invoke-WebRequest 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip' -OutFile $archive
$expected = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne $expected) {
    throw 'FFmpeg archive checksum mismatch. Nothing has been installed.'
}
Expand-Archive -LiteralPath $archive -DestinationPath $downloadRoot
$releaseRoot = Join-Path $downloadRoot 'ffmpeg-9.0.2-essentials_build'
foreach ($name in @('ffmpeg.exe','ffprobe.exe')) {
    $source = Join-Path $releaseRoot ('bin\' + $name)
    $target = Join-Path $toolsRoot $name
    if (Test-Path -LiteralPath $target) {
        if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
            throw "An existing $name differs. Review it manually; this installer will not overwrite it."
        }
    } else { Copy-Item -LiteralPath $source -Destination $target }
}
Write-Output 'Verified FFmpeg 9.0.2 installed locally. Vendor licence/source notices remain in the ignored download directory. No paid service activated.'
