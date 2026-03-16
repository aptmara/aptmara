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
$pagesIndex = Get-Content -Raw -Encoding UTF8 $pagesIndexPath
$pagesScript = Get-Content -Raw -Encoding UTF8 $pagesScriptPath

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

foreach ($requiredPattern in @(
    'class="playtable"',
    'class="stage-card"',
    'class="footer-strip"',
    'id="progress-bar"',
    'id="state-text"'
)) {
    if ($pagesIndex -notmatch $requiredPattern) {
        throw "Pages index is missing required layout pattern: $requiredPattern"
    }
}

foreach ($legacyPattern in @(
    'class="hero panel"',
    'class="board panel"',
    'class="ambient',
    'drawUi\(',
    'class="workbench"',
    'class="guidance-strip"',
    'id="score-value"',
    'id="best-value"',
    'id="time-value"',
    'id="lives-value"',
    'id="charge-bar"',
    'scoreValue',
    'finishGame\(',
    'spawnDrop\(',
    'ribbons',
    'sparks',
    'rings',
    'camera\.trauma'
)) {
    if ($pagesIndex -match $legacyPattern -or $pagesScript -match $legacyPattern) {
        throw "Legacy layout pattern still exists: $legacyPattern"
    }
}

[xml](Get-Content -Raw -Encoding UTF8 $headerPath) | Out-Null
[xml](Get-Content -Raw -Encoding UTF8 (Join-Path $root "docs\\favicon.svg")) | Out-Null

Write-Output "PROFILE_VALID"
