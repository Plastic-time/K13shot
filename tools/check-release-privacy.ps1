param([string]$Version)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path -Parent $PSScriptRoot
if (-not $Version) { $Version = (Get-Content -Raw (Join-Path $root 'package.json') | ConvertFrom-Json).version }
$secretPattern = '\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----|https?://[^\s/:"''<>]+:[^\s/@"''<>]+@'
foreach ($suffix in @('-portable', '')) {
  $file = Join-Path $root "WarThunderResearchCalculator-v$Version$suffix.zip"
  $archive = [System.IO.Compression.ZipFile]::OpenRead($file)
  $count = 0
  try {
    foreach ($entry in $archive.Entries) {
      $name = $entry.FullName.Replace('\', '/')
      if ($name -match '(^|/)(\.git|\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?)($|/)|\.(pem|pfx|key|pdb)$') {
        throw "Sensitive filename in release: $name"
      }
      if ($entry.Length -eq 0 -or $entry.Length -gt 12000000 -or $name -match '\.(exe|dll|png|jpg|jpeg|ttf|woff2?|ico|gif|webp)$') { continue }
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
      if ($content.IndexOf([char]0) -ge 0) { continue }
      $count++
      if ([regex]::IsMatch($content, $secretPattern)) { throw "Possible secret in release: $name (value redacted)" }
      if ($name -notmatch '^node_modules/' -and [regex]::IsMatch($content, '[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'']+')) {
        throw "Personal path in release: $name (value redacted)"
      }
    }
    Write-Host "Release privacy scan passed: $([System.IO.Path]::GetFileName($file)), $count text entries"
  } finally { $archive.Dispose() }
}
