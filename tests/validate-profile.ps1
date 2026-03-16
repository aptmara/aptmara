$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$readmePath = Join-Path $root "README.md"
$headerPath = Join-Path $root "assets\\header.svg"

$requiredRepos = @(
    "DesktopOrganizer",
    "GitTooljp",
    "SimpleZipper",
    "downloadEx",
    "boyscout-tajimi",
    "ECS_BACE"
)

if (-not (Test-Path $readmePath)) {
    throw "README.md not found: $readmePath"
}

if (-not (Test-Path $headerPath)) {
    throw "header.svg not found: $headerPath"
}

$readme = Get-Content -Raw $readmePath

if ($readme -notmatch "\./assets/header\.svg") {
    throw "README does not reference ./assets/header.svg"
}

foreach ($repo in $requiredRepos) {
    if ($readme -notmatch [Regex]::Escape($repo)) {
        throw "README is missing required repository reference: $repo"
    }
}

[xml](Get-Content -Raw $headerPath) | Out-Null

Write-Output "PROFILE_VALID"
