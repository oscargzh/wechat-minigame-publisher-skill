[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [Parameter(Mandatory = $true)]
    [ValidateSet(2, 3)]
    [int]$CreatorMajor
)

$ErrorActionPreference = 'Stop'

function Set-BooleanProperty {
    param(
        [Parameter(Mandatory = $true)] [object]$Object,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [bool]$Value
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    } else {
        $property.Value = $Value
    }
}

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedProject 'assets') -PathType Container)) {
    throw "项目目录缺少 assets：$resolvedProject"
}

$assetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\assets\obfuscators')).Path
if ($CreatorMajor -eq 2) {
    $toolName = 'cc-obfuscated-js-open'
    $destination = Join-Path $resolvedProject 'packages\cc-obfuscated-js-open'
} else {
    $toolName = 'cc-obfuscated-js-open-3x'
    $destination = Join-Path $resolvedProject 'extensions\cc-obfuscated-js-open-3x'
}

$source = Join-Path $assetRoot $toolName
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Skill 中缺少混淆工具：$source"
}

if (Test-Path -LiteralPath $destination) {
    $manifestPath = Join-Path $destination 'package.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "目标目录已存在但不是有效扩展，请人工检查：$destination"
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.name -ne $toolName) {
        throw "目标目录中存在其他扩展，拒绝覆盖：$destination"
    }
    $installStatus = 'reused'
} else {
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
    $installStatus = 'installed'
}

$configPath = Join-Path $destination 'runtime_Ts\cc_obfuscated_js.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
Set-BooleanProperty -Object $config -Name 'auto' -Value $true
Set-BooleanProperty -Object $config.'基本设置' -Name 'createBackup' -Value $true
Set-BooleanProperty -Object $config.'保护设置' -Name 'selfDefending' -Value $false
Set-BooleanProperty -Object $config.'混淆强度' -Name 'controlFlowFlattening' -Value $true
Set-BooleanProperty -Object $config.'混淆强度' -Name 'deadCodeInjection' -Value $true
$config.'混淆强度'.controlFlowFlatteningThreshold = 0.25
$config.'混淆强度'.deadCodeInjectionThreshold = 0.10
Set-BooleanProperty -Object $config.'标识符处理' -Name 'renameGlobals' -Value $false
Set-BooleanProperty -Object $config.'标识符处理' -Name 'renameProperties' -Value $false
$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding utf8

$nodeModules = Join-Path $destination 'node_modules'
if (-not (Test-Path -LiteralPath $nodeModules -PathType Container)) {
    Push-Location $destination
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install 失败，退出码：$LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

Push-Location $destination
try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "扩展测试失败，退出码：$LASTEXITCODE" }
} finally {
    Pop-Location
}

[PSCustomObject]@{
    status = $installStatus
    creatorMajor = $CreatorMajor
    extension = $toolName
    destination = $destination
    auto = $true
    createBackup = $true
    controlFlowFlattening = $true
    controlFlowFlatteningThreshold = 0.25
    deadCodeInjection = $true
    deadCodeInjectionThreshold = 0.10
    tests = 'passed'
} | ConvertTo-Json -Depth 4
