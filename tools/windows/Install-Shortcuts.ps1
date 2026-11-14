param(
    [Parameter(Mandatory = $true)][string]$ProjectPath,
    [string]$Distribution = 'Ubuntu'
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
# Reject quotes and control characters before placing values in Windows command lines.
if (-not $ProjectPath.StartsWith('/') -or $ProjectPath -match '["\r\n]' -or $Distribution -match '["\r\n]' -or -not $Distribution.Trim()) {
    throw 'Informe um caminho Linux absoluto e uma distribuicao WSL, sem aspas ou quebras de linha.'
}
& wsl.exe -d $Distribution -- test -f "$ProjectPath/tools/start-local.sh"
if ($LASTEXITCODE -ne 0) { throw 'Projeto nao encontrado na distribuicao informada.' }
$manual = & wsl.exe -d $Distribution -- cat "$ProjectPath/docs/manual-de-uso.md"
if ($LASTEXITCODE -ne 0) { throw 'Manual nao encontrado.' }
$destination = Join-Path $env:LOCALAPPDATA 'Meinager'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'Start-Meinager.ps1') $destination -Force
@{ ProjectPath = $ProjectPath; Distribution = $Distribution } | ConvertTo-Json | Set-Content (Join-Path $destination 'config.json') -Encoding UTF8
$content = [System.Net.WebUtility]::HtmlEncode(($manual -join "`n"))
"<!doctype html><html lang='pt-BR'><meta charset='utf-8'><title>Manual Meinager</title><style>body{max-width:900px;margin:40px auto;padding:20px;font:18px/1.6 system-ui}pre{white-space:pre-wrap;font:inherit}</style><h1>Manual Meinager</h1><pre>$content</pre></html>" | Set-Content (Join-Path $destination 'manual.html') -Encoding UTF8
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'Meinager.lnk'))
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $destination 'Start-Meinager.ps1') + '"'
$shortcut.WorkingDirectory = $destination
$shortcut.Description = 'Iniciar Meinager e abrir no navegador'
$shortcut.Save()
$manualUrl = ([System.Uri](Join-Path $destination 'manual.html')).AbsoluteUri
"[InternetShortcut]`r`nURL=$manualUrl" | Set-Content (Join-Path $desktop 'Manual Meinager.url') -Encoding ASCII
Write-Host 'Atalhos criados: Meinager e Manual Meinager. Teste-os antes de liberar o uso.'
