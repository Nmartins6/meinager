$ErrorActionPreference = 'Stop'
try {
    $config = Get-Content (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    function Test-Ready {
        try {
            $health = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2
            $web = Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2
            return ($health.status -eq 'ok' -and $health.database -eq 'up' -and $web.StatusCode -eq 200)
        } catch { return $false }
    }
    if (Test-Ready) {
        Start-Process 'http://localhost:5173'
        exit 0
    }
    function Test-Docker {
        try {
            & wsl.exe -d $config.Distribution -- docker info *> $null
            return ($LASTEXITCODE -eq 0)
        } catch { return $false }
    }
    if (-not (Test-Docker)) {
        $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (-not (Test-Path $dockerDesktop)) { throw 'Instale Docker Desktop com integracao WSL antes de usar o atalho.' }
        Start-Process $dockerDesktop
        $deadline = (Get-Date).AddSeconds(120)
        do {
            Start-Sleep -Seconds 3
            if (Test-Docker) { break }
        } while ((Get-Date) -lt $deadline)
        if (-not (Test-Docker)) { throw 'Docker nao iniciou. Confira a integracao com a distribuicao WSL.' }
    }
    $script = $config.ProjectPath.TrimEnd('/') + '/tools/start-local.sh'
    $server = Start-Process wsl.exe -ArgumentList @('-d', ('"' + $config.Distribution + '"'), '--', 'bash', ('"' + $script + '"')) -PassThru
    $deadline = (Get-Date).AddSeconds(150)
    do {
        if (Test-Ready) {
            Start-Process 'http://localhost:5173'
            exit 0
        }
        if ($server.HasExited) { throw 'A inicializacao encerrou. Execute tools/start-local.sh no Ubuntu para consultar o erro.' }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw 'O sistema nao ficou pronto no prazo. Confira a janela do servidor e as portas 3000 e 5173.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Pressione Enter para fechar'
    exit 1
}
