# Optional Windows download cache for Docker environments with interrupted TLS downloads.
# HTTPS certificate validation remains enabled. Every wheel is verified against PyPI SHA256.
$ErrorActionPreference='Stop'
$wheelRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'wheels'))
New-Item -ItemType Directory -Path $wheelRoot -Force | Out-Null
$verified=@()
foreach($line in Get-Content -LiteralPath (Join-Path $PSScriptRoot 'requirements.txt')){
 if($line -notmatch '^([a-zA-Z0-9_-]+)==([0-9.]+)$'){throw 'Invalid pinned requirement'}
 $package=$Matches[1];$version=$Matches[2]
 $metadata=Invoke-RestMethod -Uri ('https://pypi.org/pypi/'+$package+'/'+$version+'/json') -TimeoutSec 60
 $wheel=$metadata.urls | Where-Object { $_.filename -match 'cp313-cp313-manylinux.*x86_64\.whl$' -or $_.filename -match 'py3-none-any\.whl$' } | Select-Object -First 1
 if(-not $wheel){throw ('Missing Linux CPython 3.13 wheel: '+$package)}
 $filename=[string]$wheel.filename
 if([IO.Path]::GetFileName($filename) -ne $filename -or $filename -notmatch '^[a-zA-Z0-9_.-]+\.whl$' -or ([Uri]$wheel.url).Host -ne 'files.pythonhosted.org' -or ([Uri]$wheel.url).Scheme -ne 'https'){throw 'Invalid package location'}
 $destination=[IO.Path]::GetFullPath((Join-Path $wheelRoot $filename))
 if(-not $destination.StartsWith($wheelRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Wheel path escapes cache'}
 $expected=[string]$wheel.digests.sha256
 if($expected -notmatch '^[a-f0-9]{64}$'){throw 'Missing integrity digest'}
 $valid=(Test-Path -LiteralPath $destination) -and ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expected)
 if(-not $valid){
  for($attempt=1;$attempt -le 3;$attempt++){
   try{
    Write-Output ('Downloading verified wheel: '+$filename)
    # Bounded, verified HTTP ranges avoid restarting large downloads on unstable connections.
    $size=[long]$wheel.size
    if($size -le 0 -or $size -gt 104857600){throw 'Invalid package size'}
    $output=[IO.File]::Open($destination,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{
     for([long]$offset=0;$offset -lt $size;$offset+=1048576){
      $end=[Math]::Min($offset+1048575,$size-1)
      for($chunkAttempt=1;$chunkAttempt -le 3;$chunkAttempt++){
       $response=$null;$memory=New-Object IO.MemoryStream
       try{
        $request=[Net.HttpWebRequest]::Create($wheel.url)
        $request.Timeout=30000;$request.ReadWriteTimeout=30000;$request.KeepAlive=$false
        $request.AddRange($offset,$end)
        $response=$request.GetResponse()
        if([int]$response.StatusCode -ne 206 -or $response.Headers['Content-Range'] -ne ('bytes '+$offset+'-'+$end+'/'+$size)){throw 'Invalid download range'}
        $response.GetResponseStream().CopyTo($memory)
        if($memory.Length -ne ($end-$offset+1)){throw 'Incomplete range'}
        $bytes=$memory.ToArray();$output.Write($bytes,0,$bytes.Length)
        break
       }catch{if($chunkAttempt -eq 3){throw 'Range download failed'}}
       finally{if($response){$response.Close()};$memory.Dispose()}
      }
     }
    }finally{$output.Dispose()}
    if((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Integrity mismatch'}
    $valid=$true;break
   }catch{if($attempt -eq 3){throw ('Could not download a verified wheel for '+$package)}}
  }
 }
 if(-not $valid){throw 'Unverified package'}
 $verified+=@{package=$package;version=$version;file=$filename;sha256=$expected}
}
$verified | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $wheelRoot 'manifest.json') -Encoding UTF8
Write-Output ('Verified '+$verified.Count+' Linux wheels; ready for offline Docker installation.')
