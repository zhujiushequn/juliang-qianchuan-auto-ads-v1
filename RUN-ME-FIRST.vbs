Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd.exe /k cd /d """ & folder & """ && RUN-ME-FIRST.bat"
shell.Run cmd, 1, False
