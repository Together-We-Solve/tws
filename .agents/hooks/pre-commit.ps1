$staged = git diff --cached --name-only
$ragFiles = @("AGENTS.md", ".agents/rag-knowledge-base.md", ".agents/rag-maintenance.md")
$durablePatterns = @(
  "^.*\.html$",
  "^js/",
  "^css/",
  "^assets/",
  "^firestore\.rules$",
  "^\.agents/"
)
$durableChanged = $false
$ragChanged = $false
foreach ($file in $staged) {
  if ($ragFiles -contains $file) {
    $ragChanged = $true
  }
  foreach ($pattern in $durablePatterns) {
    if ($file -match $pattern) {
      $durableChanged = $true
    }
  }
}
if ($durableChanged -and -not $ragChanged) {
  Write-Host "Durable project files are staged without a staged RAG knowledge-base update."
  Write-Host "If project facts changed, update .agents/rag-knowledge-base.md and stage it."
  Write-Host "If no durable facts changed, commit again with TWS_SKIP_RAG_CHECK=1."
  if ($env:TWS_SKIP_RAG_CHECK -eq "1") {
    exit 0
  }
  exit 1
}
exit 0
