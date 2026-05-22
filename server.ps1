$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")

function Send-Text {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$Status,
        [string]$Text,
        [string]$ContentType = "text/plain; charset=utf-8"
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $Response.StatusCode = $Status
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Send-Json {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$Status,
        [hashtable]$Payload
    )

    Send-Text -Response $Response -Status $Status -Text ($Payload | ConvertTo-Json -Depth 5) -ContentType "application/json; charset=utf-8"
}

function Get-ContentType {
    param([string]$Path)

    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { "text/html; charset=utf-8" }
        ".js" { "text/javascript; charset=utf-8" }
        ".css" { "text/css; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        default { "application/octet-stream" }
    }
}

function Send-File {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$RequestPath
    )

    $relativePath = if ($RequestPath -eq "/") { "index.html" } else { $RequestPath.TrimStart("/") }
    $relativePath = [Uri]::UnescapeDataString($relativePath).Replace("/", [IO.Path]::DirectorySeparatorChar)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $root $relativePath))
    $rootPath = [IO.Path]::GetFullPath($root)

    if (-not $fullPath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Response $Response -Status 403 -Text "Forbidden"
        return
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Send-Text -Response $Response -Status 404 -Text "Not found"
        return
    }

    $bytes = [IO.File]::ReadAllBytes($fullPath)
    $Response.StatusCode = 200
    $Response.ContentType = Get-ContentType -Path $fullPath
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Fetch-Transfermarkt {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$TargetUrl
    )

    if ($TargetUrl -notmatch "^https://(www\.)?transfermarkt\.") {
        Send-Json -Response $Response -Status 400 -Payload @{
            ok = $false
            error = "A URL precisa ser do Transfermarkt."
        }
        return
    }

    try {
        $headers = @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36"
            "Accept-Language" = "pt-BR,pt;q=0.9,en;q=0.7"
        }
        $result = Invoke-WebRequest -Uri $TargetUrl -Headers $headers -UseBasicParsing
        Send-Json -Response $Response -Status 200 -Payload @{
            ok = $true
            html = $result.Content
        }
    }
    catch {
        Send-Json -Response $Response -Status 502 -Payload @{
            ok = $false
            error = $_.Exception.Message
        }
    }
}

try {
    $listener.Start()
    Write-Host "Option File Editor Pro: http://localhost:$port"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            if ($request.Url.AbsolutePath -eq "/fetch") {
                Fetch-Transfermarkt -Response $response -TargetUrl $request.QueryString["url"]
            }
            else {
                Send-File -Response $response -RequestPath $request.Url.AbsolutePath
            }
        }
        catch {
            Send-Json -Response $response -Status 500 -Payload @{
                ok = $false
                error = $_.Exception.Message
            }
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
