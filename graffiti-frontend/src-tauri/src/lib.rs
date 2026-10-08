use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[derive(Default, Clone, serde::Serialize, serde::Deserialize)]
pub struct OverlayToolbarBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Default)]
pub struct OverlayTrackingState {
    pub bounds: OverlayToolbarBounds,
    pub is_click_through: bool,
    pub is_ignoring: bool,
}

fn open_overlay_window_impl(
    app: &tauri::AppHandle,
    state: &Arc<Mutex<OverlayTrackingState>>,
) -> Result<(), String> {
    {
        let mut s = state.lock().unwrap();
        s.is_click_through = false;
        s.is_ignoring = false;
    }

    if let Some(overlay) = app.get_webview_window("overlay") {
        if overlay.is_visible().unwrap_or(false) {
            overlay.hide().map_err(|e| e.to_string())?;
        } else {
            let _ = overlay.set_ignore_cursor_events(false);
            overlay.show().map_err(|e| e.to_string())?;
            let _ = overlay.set_focus();
        }
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("Graffiti Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .fullscreen(true)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

    let _ = win.set_ignore_cursor_events(false);
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
fn open_overlay_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<OverlayTrackingState>>>,
) -> Result<(), String> {
    open_overlay_window_impl(&app, state.inner())
}

#[tauri::command]
fn close_overlay_window(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<OverlayTrackingState>>>,
) -> Result<(), String> {
    {
        let mut s = state.lock().unwrap();
        s.is_click_through = false;
        s.is_ignoring = false;
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_overlay_ignore_cursor(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<OverlayTrackingState>>>,
    ignore: bool,
) -> Result<(), String> {
    {
        let mut s = state.lock().unwrap();
        s.is_click_through = ignore;
        s.is_ignoring = ignore;
    }
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay
            .set_ignore_cursor_events(ignore)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_overlay_toolbar_bounds(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<OverlayTrackingState>>>,
    bounds: OverlayToolbarBounds,
    click_through: bool,
) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    s.bounds = bounds;
    s.is_click_through = click_through;
    if !click_through {
        s.is_ignoring = false;
        if let Some(win) = app.get_webview_window("overlay") {
            let _ = win.set_ignore_cursor_events(false);
        }
    }
    Ok(())
}

#[tauri::command]
fn open_browser_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(&url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn get_deep_link_url() -> Option<String> {
    for arg in std::env::args().skip(1) {
        let clean = arg.trim_matches('"').trim();
        if clean.starts_with("graffiti://") {
            return Some(clean.to_string());
        }
    }
    None
}

fn register_custom_protocol() {
    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = exe_path.to_string_lossy().to_string();
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let _ = std::process::Command::new("reg")
                .args(["add", "HKCU\\Software\\Classes\\graffiti", "/ve", "/t", "REG_SZ", "/d", "URL:Graffiti Protocol", "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let _ = std::process::Command::new("reg")
                .args(["add", "HKCU\\Software\\Classes\\graffiti", "/v", "URL Protocol", "/t", "REG_SZ", "/d", "", "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let cmd_val = format!("\"{}\" \"%1\"", exe_str);
            let _ = std::process::Command::new("reg")
                .args(["add", "HKCU\\Software\\Classes\\graffiti\\shell\\open\\command", "/ve", "/t", "REG_SZ", "/d", &cmd_val, "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let overlay_tracking = Arc::new(Mutex::new(OverlayTrackingState::default()));
    let overlay_tracking_thread = overlay_tracking.clone();
    let overlay_tracking_shortcut = overlay_tracking.clone();

    tauri::Builder::default()
        .manage(overlay_tracking)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            for arg in &args {
                let clean = arg.trim_matches('"').trim();
                if clean.starts_with("graffiti://") {
                    let _ = app.emit("deep-link://new-url", vec![clean.to_string()]);
                }
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            register_custom_protocol();

            #[cfg(target_os = "windows")]
            {
                let handle = app.handle().clone();
                let state_clone = overlay_tracking_thread.clone();
                std::thread::spawn(move || {
                    #[repr(C)]
                    struct POINT {
                        x: i32,
                        y: i32,
                    }
                    extern "system" {
                        fn GetCursorPos(lpPoint: *mut POINT) -> i32;
                    }

                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(25));
                        let (is_click_through, bounds, current_ignoring) = {
                            let s = state_clone.lock().unwrap();
                            (s.is_click_through, s.bounds.clone(), s.is_ignoring)
                        };

                        if !is_click_through {
                            continue;
                        }

                        if let Some(win) = handle.get_webview_window("overlay") {
                            if !win.is_visible().unwrap_or(false) {
                                continue;
                            }

                            let scale = win.scale_factor().unwrap_or(1.0);
                            let mut pt = POINT { x: 0, y: 0 };
                            let ok = unsafe { GetCursorPos(&mut pt) };
                            if ok != 0 {
                                let cx = (pt.x as f64) / scale;
                                let cy = (pt.y as f64) / scale;

                                // Buffer of 8px around toolbar for effortless, smooth hovering
                                let in_toolbar = cx >= (bounds.x - 8.0)
                                    && cx <= (bounds.x + bounds.width + 8.0)
                                    && cy >= (bounds.y - 8.0)
                                    && cy <= (bounds.y + bounds.height + 8.0);

                                let should_ignore = !in_toolbar;
                                if should_ignore != current_ignoring {
                                    let _ = win.set_ignore_cursor_events(should_ignore);
                                    let mut s = state_clone.lock().unwrap();
                                    s.is_ignoring = should_ignore;
                                }
                            }
                        }
                    }
                });
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                let _ = open_overlay_window_impl(&handle, &overlay_tracking_shortcut);
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_overlay_window,
            close_overlay_window,
            set_overlay_ignore_cursor,
            set_overlay_toolbar_bounds,
            open_browser_url,
            focus_main_window,
            get_deep_link_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
