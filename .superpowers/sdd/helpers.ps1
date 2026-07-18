$ErrorActionPreference = 'Stop'

function Extract-TaskBrief {
  param(
    [string]$PlanFile,
    [int]$TaskNum,
    [string]$OutFile
  )
  $lines = Get-Content -Path $PlanFile
  # find "### Task N:" header
  $start = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^### Task ${TaskNum}:") { $start = $i; break }
  }
  if ($start -lt 0) { throw "Task $TaskNum not found" }
  # end at next "### Task" or end of Global Constraints region or EOF
  $end = $lines.Count
  for ($j = $start + 1; $j -lt $lines.Count; $j++) {
    if ($lines[$j] -match '^### Task ') { $end = $j; break }
  }
  $brief = $lines[$start..($end - 1)]
  Set-Content -Path $OutFile -Value $brief
  return $OutFile
}

function New-ReviewPackage {
  param(
    [string]$Base,
    [string]$Head,
    [string]$OutFile,
    [string]$RepoDir
  )
  $log = git -C $RepoDir log --oneline "$Base..$Head"
  $stat = git -C $RepoDir diff --stat "$Base" "$Head"
  $diff = git -C $RepoDir diff -U10 "$Base" "$Head"
  $content = @"
# Review package $Base..$Head

## Commits
$log

## Stat
$stat

## Diff
$diff
"@
  Set-Content -Path $OutFile -Value $content
  return $OutFile
}

