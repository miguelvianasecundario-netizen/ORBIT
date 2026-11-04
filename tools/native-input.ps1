param([ValidateSet('status','middle','alt-middle','hotkey','escape','outside','hotkey-free','capture','dialog-tree','choose-folder','move')][string]$Action='status',[string]$OutputPath,[int]$OrbitProcessId=0,[int]$X=600,[int]$Y=400)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OrbitQA {
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(IntPtr cls,string title);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h,int id,uint mods,uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h,int id);
  public delegate bool EnumProc(IntPtr h,IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,System.Text.StringBuilder name,int max);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
  public static IntPtr Dialog(uint pid) { IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);var name=new System.Text.StringBuilder(128);GetClassName(h,name,128);if(p==pid && name.ToString()=="#32770"){found=h;return false;}return true;},IntPtr.Zero);return found; }
  public static IntPtr MainWindow(uint pid) { IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);RECT r;GetWindowRect(h,out r);if(p==pid && r.Right-r.Left>200 && r.Bottom-r.Top>200){found=h;return false;}return true;},IntPtr.Zero);return found; }
  public static void Key(byte key,bool up) { keybd_event(key,0,up?2u:0u,UIntPtr.Zero); }
}
'@
[OrbitQA]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))|Out-Null
$handle=[OrbitQA]::MainWindow($OrbitProcessId)
switch ($Action) {
  'move' { [OrbitQA]::SetCursorPos($X,$Y)|Out-Null }
  'dialog-tree' {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $dialog=[OrbitQA]::Dialog($OrbitProcessId)
    if($dialog -eq [IntPtr]::Zero){throw 'Seletor nativo não encontrado'}
    $root=[Windows.Automation.AutomationElement]::FromHandle($dialog)
    $elements=$root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
    $rows=@();foreach($element in $elements){if($element.Current.ControlType.ProgrammaticName -in @('ControlType.Edit','ControlType.Button')){$rows+=@{name=$element.Current.Name;id=$element.Current.AutomationId;type=$element.Current.ControlType.ProgrammaticName}}}
    @{controls=$rows}|ConvertTo-Json -Depth 5 -Compress;exit
  }
  'choose-folder' {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog=[OrbitQA]::Dialog($OrbitProcessId)
    if($dialog -eq [IntPtr]::Zero){throw 'Seletor nativo não encontrado'}
    [OrbitQA]::SetForegroundWindow($dialog)|Out-Null
    [Windows.Forms.SendKeys]::SendWait('^l');Start-Sleep -Milliseconds 100
    [Windows.Forms.SendKeys]::SendWait($OutputPath);[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 400
    [OrbitQA]::SendMessage($dialog,0x111,[IntPtr]::new(1),[IntPtr]::Zero)|Out-Null;Start-Sleep -Milliseconds 300
  }
  'middle' { [OrbitQA]::SetCursorPos(600,400)|Out-Null;[OrbitQA]::mouse_event(0x20,0,0,0,[UIntPtr]::Zero);[OrbitQA]::mouse_event(0x40,0,0,0,[UIntPtr]::Zero) }
  'alt-middle' { [OrbitQA]::Key(0x12,$false);[OrbitQA]::SetCursorPos(600,400)|Out-Null;[OrbitQA]::mouse_event(0x20,0,0,0,[UIntPtr]::Zero);[OrbitQA]::mouse_event(0x40,0,0,0,[UIntPtr]::Zero);[OrbitQA]::Key(0x12,$true) }
  'hotkey' { [OrbitQA]::Key(0x11,$false);[OrbitQA]::Key(0x12,$false);[OrbitQA]::Key(0x20,$false);[OrbitQA]::Key(0x20,$true);[OrbitQA]::Key(0x12,$true);[OrbitQA]::Key(0x11,$true) }
  'escape' { [OrbitQA]::Key(0x1b,$false);[OrbitQA]::Key(0x1b,$true) }
  'outside' { [OrbitQA]::SetCursorPos(2,2)|Out-Null;[OrbitQA]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[OrbitQA]::mouse_event(4,0,0,0,[UIntPtr]::Zero) }
  'hotkey-free' { $free=[OrbitQA]::RegisterHotKey([IntPtr]::Zero,991,0x4003,0x20);if($free){[OrbitQA]::UnregisterHotKey([IntPtr]::Zero,991)|Out-Null};@{free=$free}|ConvertTo-Json -Compress;exit }
  'capture' {
    Add-Type -AssemblyName System.Drawing
    $r=[OrbitQA+RECT]::new();[OrbitQA]::GetWindowRect($handle,[ref]$r)|Out-Null
    $bmp=[Drawing.Bitmap]::new($r.Right-$r.Left,$r.Bottom-$r.Top);$g=[Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($r.Left,$r.Top,0,0,$bmp.Size);$bmp.Save($OutputPath);$g.Dispose();$bmp.Dispose()
  }
}
Start-Sleep -Milliseconds 250
$rect=[OrbitQA+RECT]::new();[OrbitQA]::GetWindowRect($handle,[ref]$rect)|Out-Null
@{exists=$handle -ne [IntPtr]::Zero;visible=[OrbitQA]::IsWindowVisible($handle);x=$rect.Left;y=$rect.Top;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top}|ConvertTo-Json -Compress
