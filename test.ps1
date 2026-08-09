$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $project 'build.ps1')

Push-Location $project
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed with exit code $LASTEXITCODE." }
    & npm run test:host
    if ($LASTEXITCODE -ne 0) { throw "Host simulation failed with exit code $LASTEXITCODE." }
    & npm run smoke
    if ($LASTEXITCODE -ne 0) { throw "Electron smoke test failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

$requiredDocs = @('README.md', 'README.zh-CN.md', 'PRIVACY.md', 'PRIVACY.zh-CN.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md')
foreach ($relative in $requiredDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $project $relative))) {
        throw "Required project file is missing: $relative"
    }
}

Write-Host 'Repository verification passed.'
