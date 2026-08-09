$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()
$package = Get-Content -Raw -Encoding UTF8 (Join-Path $project 'package.json') | ConvertFrom-Json
if ($package.version -ne $version) {
    throw "VERSION ($version) and package.json ($($package.version)) do not match."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 20 or newer is required.'
}
if (-not (Test-Path -LiteralPath (Join-Path $project 'node_modules\electron'))) {
    throw 'Dependencies are missing. Run npm ci first.'
}

Push-Location $project
try {
    & npm run icon
    if ($LASTEXITCODE -ne 0) { throw "Icon build failed with exit code $LASTEXITCODE." }
    & npm run native
    if ($LASTEXITCODE -ne 0) { throw "Native helper build failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

Write-Host "Codex Quota Overlay $version build inputs are ready for $([System.Environment]::OSVersion.Platform)."
