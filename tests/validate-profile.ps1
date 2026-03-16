$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$readmePath = Join-Path $root "README.md"
$headerPath = Join-Path $root "assets\\header.svg"
$pagesIndexPath = Join-Path $root "docs\\index.html"
$pagesStylesPath = Join-Path $root "docs\\styles.css"
$pagesScriptPath = Join-Path $root "docs\\game.js"

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

foreach ($pagesPath in @($pagesIndexPath, $pagesStylesPath, $pagesScriptPath)) {
    if (-not (Test-Path $pagesPath)) {
        throw "Pages asset not found: $pagesPath"
    }
}

$readme = Get-Content -Raw -Encoding UTF8 $readmePath

if ($readme -notmatch "\./assets/header\.svg") {
    throw "README does not reference ./assets/header.svg"
}

if ($readme -notmatch "https://aptmara\.github\.io/aptmara/") {
    throw "README does not reference the GitHub Pages game"
}

foreach ($repo in $requiredRepos) {
    if ($readme -notmatch [Regex]::Escape($repo)) {
        throw "README is missing required repository reference: $repo"
    }
}

[xml](Get-Content -Raw -Encoding UTF8 $headerPath) | Out-Null
[xml](Get-Content -Raw -Encoding UTF8 (Join-Path $root "docs\\favicon.svg")) | Out-Null

Write-Output "PROFILE_VALID"
