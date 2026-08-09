$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $project 'VERSION')).Trim()
$program = Get-Content -Raw -Encoding UTF8 (Join-Path $project 'Program.cs')
if ($program -notmatch ('internal const string Version = "' + [regex]::Escape($version) + '";')) {
    throw "VERSION and AppInfo.Version do not match."
}

$output = Join-Path $project 'artifacts\bin'
New-Item -ItemType Directory -Path $output -Force | Out-Null

$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    throw "找不到 .NET Framework 编译器：$compiler"
}

$references = @(
    'System.dll',
    'System.Core.dll',
    'System.Configuration.dll',
    'System.Drawing.dll',
    'System.Net.Http.dll',
    'System.Web.Extensions.dll',
    'System.Windows.Forms.dll'
)

$arguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/optimize+',
    '/debug-',
    '/warn:4',
    "/out:$(Join-Path $output 'CodexQuotaOverlay.exe')",
    "/win32manifest:$(Join-Path $project 'app.manifest')"
)

$arguments += $references | ForEach-Object { "/reference:$_" }
$arguments += Join-Path $project 'Program.cs'

& $compiler @arguments
if ($LASTEXITCODE -ne 0) {
    throw "编译失败，退出码 $LASTEXITCODE"
}

Copy-Item -LiteralPath (Join-Path $project 'App.config') -Destination (Join-Path $output 'CodexQuotaOverlay.exe.config') -Force

Get-Item -LiteralPath (Join-Path $output 'CodexQuotaOverlay.exe') |
    Select-Object FullName, Length, LastWriteTime, @{Name='Version';Expression={$_.VersionInfo.FileVersion}}
