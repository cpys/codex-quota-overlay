[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()

if (-not $SkipBuild) {
    & (Join-Path $project 'build.ps1')
}

$release = Join-Path $project 'artifacts\release'
New-Item -ItemType Directory -Path $release -Force | Out-Null

$portable = Join-Path $release "CodexQuotaOverlay-Portable-$version.zip"
if (Test-Path -LiteralPath $portable) {
    Remove-Item -LiteralPath $portable -Force
}
$portableFiles = @(
    (Join-Path $project 'artifacts\bin\CodexQuotaOverlay.exe'),
    (Join-Path $project 'artifacts\bin\CodexQuotaOverlay.exe.config'),
    (Join-Path $project 'README.md'),
    (Join-Path $project 'README.zh-CN.md'),
    (Join-Path $project 'PRIVACY.md'),
    (Join-Path $project 'LICENSE')
)
Compress-Archive -LiteralPath $portableFiles -DestinationPath $portable -CompressionLevel Optimal

$isccCandidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not $isccCandidates) {
    throw 'Inno Setup 6 was not found. Install JRSoftware.InnoSetup with winget, then run package.ps1 again.'
}

& $isccCandidates "/DMyAppVersion=$version" (Join-Path $project 'installer\CodexQuotaOverlay.iss')
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup failed with exit code $LASTEXITCODE."
}

$files = Get-ChildItem -LiteralPath $release -File | Where-Object { $_.Extension -in '.exe', '.zip' }
$checksumPath = Join-Path $release 'SHA256SUMS.txt'
$checksumLines = foreach ($file in $files) {
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($file.Name)"
}
$checksumLines | Set-Content -LiteralPath $checksumPath -Encoding ASCII

Get-ChildItem -LiteralPath $release -File | Select-Object Name, Length, LastWriteTime
