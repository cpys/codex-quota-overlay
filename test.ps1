$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $project 'build.ps1')

$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$output = Join-Path $project 'artifacts\tests'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$runner = Join-Path $output 'TestRunner.exe'

& $compiler /nologo /target:exe /platform:anycpu /optimize+ /warn:4 "/out:$runner" "/reference:System.dll" "/reference:System.Core.dll" (Join-Path $project 'tests\TestRunner.cs')
if ($LASTEXITCODE -ne 0) {
    throw "Test compilation failed with exit code $LASTEXITCODE."
}

$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()
& $runner (Join-Path $project 'artifacts\bin\CodexQuotaOverlay.exe') $version
if ($LASTEXITCODE -ne 0) {
    throw "Tests failed with exit code $LASTEXITCODE."
}

$requiredDocs = @('README.md', 'README.zh-CN.md', 'PRIVACY.md', 'PRIVACY.zh-CN.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md')
foreach ($relative in $requiredDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $project $relative))) {
        throw "Required project file is missing: $relative"
    }
}

Write-Host 'Repository verification passed.'
