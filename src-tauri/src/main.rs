#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    if orbit_lib::browser_host::native_invocation() {
        if let Err(error) = orbit_lib::browser_host::run() {
            eprintln!("ORBIT bridge: {error}");
        }
        return;
    }
    orbit_lib::run();
}
