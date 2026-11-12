$orig = Get-Location
Set-Location -Path "D:\CascadeProjects\unstable-unicorns-online-new"
node _fe_debug_end.js
Set-Location -Path $orig
