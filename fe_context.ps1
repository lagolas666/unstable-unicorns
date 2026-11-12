$orig = Get-Location
Set-Location -Path "D:\CascadeProjects\unstable-unicorns-online-new"
node _fe_context.js
Set-Location -Path $orig
