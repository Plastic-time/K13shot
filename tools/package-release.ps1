param(
  [string]$Version
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Version)) {
  $package = Get-Content -Raw -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json
  $Version = $package.version
}

$releaseRoot = Join-Path $root "dist-package\\v$Version"
if (Test-Path -LiteralPath $releaseRoot) {
  throw "Release staging directory already exists: $releaseRoot"
}

$launcherOutput = Join-Path $releaseRoot "launcher"
$portableRoot = Join-Path $releaseRoot "WarThunderResearchCalculator-v$Version-portable"
$portableZip = Join-Path $root "WarThunderResearchCalculator-v$Version-portable.zip"
$sourceRoot = Join-Path $releaseRoot "WarThunderResearchCalculator-v$Version"
$sourceZip = Join-Path $root "WarThunderResearchCalculator-v$Version.zip"

New-Item -ItemType Directory -Path $launcherOutput, $portableRoot, $sourceRoot -Force | Out-Null

Push-Location $root
try {
  dotnet publish ./tools/launcher/WarThunderResearchLauncher.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $launcherOutput
  if ($LASTEXITCODE -ne 0) { throw "Failed to build the Windows launcher." }
} finally {
  Pop-Location
}

$portableItems = @("config", "database", "dict", "public", "src", "node_modules", "main.js", "package.json", "package-lock.json", "README.md", "node.exe")
foreach ($item in $portableItems) {
  if ($item -eq "node.exe" -and -not (Test-Path -LiteralPath (Join-Path $root $item))) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Copy-Item -LiteralPath $nodePath -Destination (Join-Path $portableRoot "node.exe") -Force
    continue
  }
  Copy-Item -LiteralPath (Join-Path $root $item) -Destination $portableRoot -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $launcherOutput "WarThunderResearchCalculator.exe") -Destination $portableRoot -Force

$sourceItems = @("config", "database", "dict", "doc", "docs", "public", "src", ".github", ".gitignore", "main.js", "package.json", "package-lock.json", "README.md")
foreach ($item in $sourceItems) {
  Copy-Item -LiteralPath (Join-Path $root $item) -Destination $sourceRoot -Recurse -Force
}

$sourceLauncherRoot = Join-Path $sourceRoot "tools\\launcher"
New-Item -ItemType Directory -Path $sourceLauncherRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root "tools\\package-release.ps1") -Destination (Join-Path $sourceRoot "tools") -Force
Copy-Item -LiteralPath (Join-Path $root "tools\\launcher\\WarThunderResearchLauncher.csproj") -Destination $sourceLauncherRoot -Force
Copy-Item -LiteralPath (Join-Path $root "tools\\launcher\\Program.cs") -Destination $sourceLauncherRoot -Force
Copy-Item -LiteralPath (Join-Path $root "tools\\launcher\\app.manifest") -Destination $sourceLauncherRoot -Force

Compress-Archive -Path (Join-Path $portableRoot "*") -DestinationPath $portableZip -CompressionLevel Optimal
Compress-Archive -Path (Join-Path $sourceRoot "*") -DestinationPath $sourceZip -CompressionLevel Optimal

Write-Host "Created $portableZip"
Write-Host "Created $sourceZip"

