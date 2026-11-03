use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use windows_sys::Win32::{
    Foundation::{POINT, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::WindowsAndMessaging::GetCursorPos,
};

pub fn activate(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Janela indisponível.")?;
    let mut point = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut point) } == 0 {
        return Err("Não foi possível localizar o cursor.".into());
    }
    let monitor = unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST) };
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        rcMonitor: RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
        rcWork: RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
        dwFlags: 0,
    };
    if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
        return Err("Monitor indisponível.".into());
    }
    let scale = window
        .available_monitors()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|m| m.position().x == info.rcMonitor.left && m.position().y == info.rcMonitor.top)
        .map(|m| m.scale_factor())
        .unwrap_or(1.0);
    let r = info.rcWork;
    let width = (560.0 * scale).round().min((r.right - r.left) as f64) as u32;
    let height = (360.0 * scale).round().min((r.bottom - r.top) as f64) as u32;
    let left = point.x > r.left + (r.right - r.left) / 2;
    let center_x = if left { 0.71 } else { 0.29 };
    let x = (point.x - (width as f64 * center_x) as i32).clamp(r.left, r.right - width as i32);
    let y = (point.y - (height as f64 * 0.53) as i32).clamp(r.top, r.bottom - height as i32);
    window
        .set_size(PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    window
        .emit(
            "orbit:activate",
            serde_json::json!({"branchSide":if left{"left"}else{"right"}}),
        )
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
