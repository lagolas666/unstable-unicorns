$orig = Get-Location
Set-Location -Path "D:\CascadeProjects\unstable-unicorns-online-new"
node _fe_brace_check.js
Set-Location -Path $orig
