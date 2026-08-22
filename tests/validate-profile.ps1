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

$readme = Get-Content -Raw -Encoding UTF8 $readmePath

if ($readme -notmatch "\./profile-card\.png") {
    throw "README does not reference ./profile-card.png"
}

foreach ($repo in $requiredRepos) {
    if ($readme -notmatch [Regex]::Escape($repo)) {
        throw "README is missing required repository reference: $repo"
    }
}

[xml](Get-Content -Raw -Encoding UTF8 $headerPath) | Out-Null

Write-Output "PROFILE_VALID"
