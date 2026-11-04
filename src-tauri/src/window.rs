use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
use windows_sys::Win32::{
    Foundation::{POINT, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::WindowsAndMessaging::GetCursorPos,
};
#[path = "window_geometry.rs"]
mod geometry;
use geometry::{placement, WorkArea};

pub fn activate(app: &AppHandle) -> Result<(), String> {
    // Do not replace the form while a native file/folder picker owns it.
    if crate::desktop::dialog_active() {
        return Ok(());
    }
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
    let p = placement(
        (point.x, point.y),
        WorkArea {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
        },
        scale,
    )?;
    // Enter the target monitor before sizing. A DPI transition can otherwise
    // resize a window that was already fitted to the new monitor's work area.
    window
        .set_position(PhysicalPosition::new(p.x, p.y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(p.width, p.height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(p.x, p.y))
        .map_err(|e| e.to_string())?;
    window
        .emit(
            "orbit:activate",
            serde_json::json!({"branchSide":if p.branch_left{"left"}else{"right"}}),
        )
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
