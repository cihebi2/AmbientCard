use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        match window.is_visible() {
            Ok(visible) => {
                if visible {
                    let _ = window.unminimize();
                    window.set_focus().map_err(|error| error.to_string())?;
                    return Ok(());
                } else {
                    let _ = window.unminimize();
                    window.show().map_err(|error| error.to_string())?;
                    window.set_focus().map_err(|error| error.to_string())?;
                    return Ok(());
                }
            }
            Err(_) => {
                let _ = window.close();
            }
        }
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("/settings.html".into()))
        .title("AmbientCard Settings")
        .inner_size(1120.0, 760.0)
        .min_inner_size(940.0, 680.0)
        .center()
        .decorations(false)
        .resizable(true)
        .visible(true)
        .focused(true)
        .shadow(true)
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn quit_application(app: AppHandle) {
    app.exit(0);
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_settings_window,
            quit_application
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
