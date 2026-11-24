param(
    [string]$OutputDirectory = (Join-Path $env:TEMP ('tattoo-shop-manager-fnd01-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $repositoryRoot

# No --linked, --db-url, login, push or migration repair is used in this script.
# A reset is deliberately limited to the disposable local Supabase project.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Missing prerequisite: node. No database commands have been executed.'
}

# npm installs Supabase in this project, not globally on PATH.
$supabaseCommand = Join-Path $repositoryRoot 'node_modules/.bin/supabase.cmd'
if (-not (Test-Path -LiteralPath $supabaseCommand)) {
    $globalSupabase = Get-Command supabase -ErrorAction SilentlyContinue
    if (-not $globalSupabase) { throw 'Missing prerequisite: Supabase CLI. Run npm install in the project first.' }
    $supabaseCommand = $globalSupabase.Source
}

# Existing terminals may not see the PATH changes from a new Docker install.
$dockerExecutable = Get-Command docker -ErrorAction SilentlyContinue
$dockerCommand = if ($dockerExecutable) { $dockerExecutable.Source } else { $null }
if (-not $dockerCommand) {
    $dockerCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'),
        (Join-Path $env:ProgramFiles 'Docker/Docker/resources/bin/docker.exe')
    )
    foreach ($candidate in $dockerCandidates) {
        try {
            if (Test-Path -LiteralPath $candidate) { $dockerCommand = $candidate; break }
        } catch [System.UnauthorizedAccessException] {
            throw 'This terminal is denied access to the Docker installation. Run this script in your own PowerShell terminal.'
        }
    }
}
if (-not $dockerCommand) {
    throw 'Docker CLI is not accessible from this terminal. Open a new PowerShell after installing Docker Desktop.'
}
# Let Supabase locate the same Docker CLI without altering the user's saved PATH.
$env:Path = (Split-Path -Parent $dockerCommand) + [System.IO.Path]::PathSeparator + $env:Path
if ($env:SUPABASE_PROJECT_ID -and $env:SUPABASE_PROJECT_ID -ne 'tattoo-shop-manager') {
    throw 'SUPABASE_PROJECT_ID overrides the disposable project. Use a terminal without that override.'
}
& $dockerCommand version --format '{{.Server.Version}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker engine is not ready or is inaccessible to this terminal.' }
& $supabaseCommand --version
if ($LASTEXITCODE -ne 0) { throw 'Supabase CLI failed to run.' }

& node --preserve-symlinks --preserve-symlinks-main scripts/db/check-migrations.mjs
if ($LASTEXITCODE -ne 0) { throw 'Migration integrity check failed.' }
& node --preserve-symlinks --preserve-symlinks-main scripts/db/audit-reconstruction.mjs
if ($LASTEXITCODE -ne 0) { throw 'Static reconstruction audit failed.' }

& $supabaseCommand start
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase failed to start.' }
& $supabaseCommand db reset --local --no-seed
if ($LASTEXITCODE -ne 0) { throw 'Fresh local migration replay failed.' }

$configText = Get-Content -Raw -Encoding utf8 supabase/config.toml
if ($configText -notmatch '(?m)^project_id\s*=\s*"([A-Za-z0-9_-]+)"\s*$') {
    throw 'Cannot resolve the local project container name from config.toml.'
}
$databaseContainer = 'supabase_db_' + $Matches[1]
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$localSnapshotPath = Join-Path $OutputDirectory 'local-catalog.json'
$comparisonPath = Join-Path $OutputDirectory 'schema-diff.txt'
$comparisonJsonPath = Join-Path $OutputDirectory 'schema-diff.json'
$snapshotQuery = Get-Content -Raw -Encoding utf8 supabase/schema-snapshot.sql
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$snapshotOutput = $snapshotQuery | & $dockerCommand exec -i $databaseContainer psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Local catalog export failed.' }
$snapshotJson = ($snapshotOutput -join "`n").Trim()
$null = $snapshotJson | ConvertFrom-Json
[System.IO.File]::WriteAllText($localSnapshotPath, $snapshotJson + "`n", [System.Text.UTF8Encoding]::new($false))

& node --preserve-symlinks --preserve-symlinks-main scripts/db/compare-snapshots.mjs supabase/snapshots/production-catalog-20261123.json $localSnapshotPath --reviewed supabase/reviewed-differences.json --json-output $comparisonJsonPath |
    Tee-Object -FilePath $comparisonPath
if ($LASTEXITCODE -ne 0) {
    throw "Local replay succeeded but catalog differences require review: $comparisonPath"
}
Write-Output "Fresh local replay and captured catalog comparison passed. Evidence: $OutputDirectory"
Write-Output 'Snapshot exclusions and operational behavior still require review before closing FND-01.'
