[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()

if (-not $SkipBuild) {
    & (Join-Path $project 'test.ps1')
}

Push-Location $project
try {
    & npm run dist:win
    if ($LASTEXITCODE -ne 0) { throw "Electron Windows packaging failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

$unpacked = Join-Path $project 'artifacts\electron\win-unpacked'
$packagedExe = Join-Path $unpacked 'CodexQuotaOverlay.exe'
if (-not (Test-Path -LiteralPath $packagedExe)) {
    throw 'Packaged Windows executable was not produced.'
}

$selfTestPath = Join-Path ([System.IO.Path]::GetTempPath()) "cqo-self-test-$PID.json"
try {
    $selfTestProcess = Start-Process -FilePath $packagedExe -ArgumentList "--self-test=$selfTestPath" -PassThru -Wait -WindowStyle Hidden
    if ($selfTestProcess.ExitCode -ne 0) { throw "Packaged Windows self-test failed with exit code $($selfTestProcess.ExitCode)." }
    if (-not (Test-Path -LiteralPath $selfTestPath)) { throw 'Packaged Windows self-test did not create a result.' }
    $selfTest = Get-Content -Raw -Encoding UTF8 -LiteralPath $selfTestPath | ConvertFrom-Json
    if (-not $selfTest.ok -or -not $selfTest.packaged -or $selfTest.platform -ne 'win32' -or $selfTest.version -ne $version) {
        throw "Packaged Windows self-test returned unexpected data: $($selfTest | ConvertTo-Json -Compress)"
    }
}
finally {
    Remove-Item -LiteralPath $selfTestPath -Force -ErrorAction SilentlyContinue
}

$release = Join-Path $project 'artifacts\release'
New-Item -ItemType Directory -Path $release -Force | Out-Null
$portable = Join-Path $release "CodexQuotaOverlay-Windows-Portable-$version-x64.zip"

$isccCandidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not $isccCandidates) {
    throw 'Inno Setup 6 was not found. Install JRSoftware.InnoSetup, then run package.ps1 again.'
}

& $isccCandidates "/DMyAppVersion=$version" (Join-Path $project 'installer\CodexQuotaOverlay.iss')
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup failed with exit code $LASTEXITCODE."
}

# Antivirus scanners can briefly hold the freshly rewritten executable. Retry the
# portable archive instead of publishing a truncated ZIP.
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        if (Test-Path -LiteralPath $portable) {
            Remove-Item -LiteralPath $portable -Force
        }
        Compress-Archive -Path (Join-Path $unpacked '*') -DestinationPath $portable -CompressionLevel Optimal -ErrorAction Stop
        break
    }
    catch {
        if ($attempt -eq 5) { throw }
        Start-Sleep -Seconds (2 * $attempt)
    }
}

$expectedNames = @(
    "CodexQuotaOverlay-Windows-Setup-$version-x64.exe",
    "CodexQuotaOverlay-Windows-Portable-$version-x64.zip"
)
$files = foreach ($name in $expectedNames) {
    Get-Item -LiteralPath (Join-Path $release $name)
}
$checksumPath = Join-Path $release "SHA256SUMS-Windows-$version.txt"
$checksumLines = foreach ($file in $files) {
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $($file.Name)"
}
$checksumLines | Set-Content -LiteralPath $checksumPath -Encoding ASCII

Get-Item -LiteralPath ($files.FullName + $checksumPath) | Select-Object Name, Length, LastWriteTime
