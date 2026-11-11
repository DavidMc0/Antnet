# Build the loader for antnet.autonomirror.com and publish it to the VPS.
#   .\deploy\deploy.ps1 -Server user@203.0.113.10
# Each deploy goes into its own folder under /var/www/antnet/releases and then the
# "current" link switches to it in one step, so visitors never see a half-copied shell.
# The last five releases are kept; to roll back, point "current" at an older one.

param(
    [Parameter(Mandatory = $true)][string]$Server,
    [string]$Remote = "/var/www/antnet"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

npm run build:deploy
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

$release = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $env:TEMP "antnet-$release.tar.gz"
tar -czf $archive -C dist .
if ($LASTEXITCODE -ne 0) { throw "Packing dist failed." }

scp $archive "${Server}:/tmp/antnet-$release.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "Upload failed." }

$script = @"
set -e
mkdir -p $Remote/releases/$release
tar -xzf /tmp/antnet-$release.tar.gz -C $Remote/releases/$release
rm /tmp/antnet-$release.tar.gz
ln -sfn $Remote/releases/$release $Remote/current.new
mv -T $Remote/current.new $Remote/current
cd $Remote/releases && ls -1 | sort | head -n -5 | xargs -r rm -rf
echo "Live: release $release"
"@
$script -replace "`r", "" | ssh $Server "bash -s"
if ($LASTEXITCODE -ne 0) { throw "Switching the release failed." }

Remove-Item $archive
