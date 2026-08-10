$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $project 'build.ps1')

Push-Location $project
try {
    & npm run verify
    if ($LASTEXITCODE -ne 0) { throw "Repository verification failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

$requiredDocs = @(
    'README.md',
    'README.zh-CN.md',
    'PRIVACY.md',
    'PRIVACY.zh-CN.md',
    'LICENSE',
    'CHANGELOG.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'GOVERNANCE.md',
    'MAINTAINERS.md',
    'ROADMAP.md',
    'SUPPORT.md',
    'THIRD_PARTY_NOTICES.md'
)
foreach ($relative in $requiredDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $project $relative))) {
        throw "Required project file is missing: $relative"
    }
}

$packageVersion = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'package.json') | ConvertFrom-Json).version
$fileVersion = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()
if ($packageVersion -ne $fileVersion) {
    throw "Version mismatch: package.json=$packageVersion VERSION=$fileVersion"
}

Write-Host 'Repository verification passed.'
