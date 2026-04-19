// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{history, power};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            power::get_power_status,
            history::get_today_stats,
            hide_window,
        ])
        .setup(|app| {
            // Show popup on all spaces, including fullscreen apps
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_visible_on_all_workspaces(true);
            }
            setup_tray(app)?;
            start_tray_update_loop(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running WattsOrbit");
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

// ── Tray setup ────────────────────────────────────────────────────────────────

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open_dashboard = MenuItemBuilder::with_id("dashboard", "Open Dashboard").build(app)?;
    let separator      = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit           = MenuItemBuilder::with_id("quit", "Quit WattsOrbit").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&open_dashboard)
        .item(&separator)
        .item(&quit)
        .build()?;

    let tray_icon = tauri::image::Image::from_path(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("icons/tray.png")
    ).unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

    TrayIconBuilder::with_id("watts-tray")
        .icon(tray_icon)
        .icon_as_template(false)
        .tooltip("WattsOrbit — click for power details")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "dashboard" => {
                if let Some(window) = app.get_webview_window("dashboard") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                position,
                ..
            } = event {
                let app = tray.app_handle();
                let Some(window) = app.get_webview_window("main") else { return };

                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                    return;
                }

                let w = 380_f64;
                let x = position.x - w / 2.0;
                let y = position.y + 8.0;
                let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                let _ = window.show();
                let _ = window.set_focus();
            }
        })
        .build(app)?;
    Ok(())
}

// ── Notification state ────────────────────────────────────────────────────────

struct NotifState {
    last_weak_charger:  Option<Instant>,
    last_low_battery:   Option<Instant>,
    weak_charger_ticks: u32,
}

static NOTIF: Mutex<NotifState> = Mutex::new(NotifState {
    last_weak_charger:  None,
    last_low_battery:   None,
    weak_charger_ticks: 0,
});

const NOTIF_COOLDOWN: Duration = Duration::from_secs(30 * 60); // 30 min between repeats
const WEAK_CHARGER_TICKS: u32 = 3;                             // 3 × 10 s = 30 s sustained

fn check_notifications(status: &power::PowerStatus) {
    let Ok(mut st) = NOTIF.lock() else { return };
    let now = Instant::now();

    let due = |last: Option<Instant>| last.map(|t| now.duration_since(t) > NOTIF_COOLDOWN).unwrap_or(true);

    // ── Weak charger: delivers less than the system consumes ──────────────────
    if status.is_charging {
        if let (Some(w_in), Some(w_out)) = (status.watts_in, status.watts_out) {
            if w_in < w_out && w_out > 5.0 {
                st.weak_charger_ticks += 1;
                if st.weak_charger_ticks >= WEAK_CHARGER_TICKS && due(st.last_weak_charger) {
                    st.last_weak_charger = Some(now);
                    st.weak_charger_ticks = 0;
                    let delta = w_out - w_in;
                    notify(
                        "WattsOrbit — Weak Charger",
                        &format!(
                            "Your charger delivers {:.0}W but your Mac needs {:.0}W. \
                             Net drain: {:.0}W. Try a higher-wattage adapter.",
                            w_in, w_out, delta
                        ),
                    );
                }
            } else {
                st.weak_charger_ticks = 0;
            }
        }
    } else {
        st.weak_charger_ticks = 0;

        // ── Low battery with USB devices draining ─────────────────────────────
        if let Some(mins_left) = status.time_remaining_min {
            if mins_left < 30 && !status.connected_devices.is_empty() {
                let dev_watts: f64 = status.connected_devices.iter()
                    .map(|d| d.current_ma.unwrap_or(0) as f64
                        * d.voltage_mv.unwrap_or(5000) as f64 / 1_000_000.0)
                    .sum();

                if dev_watts > 1.0 && due(st.last_low_battery) {
                    st.last_low_battery = Some(now);
                    let n = status.connected_devices.len();
                    notify(
                        "WattsOrbit — Low Battery",
                        &format!(
                            "{} USB device{} ({:.1}W) {} your battery. ~{} min left. \
                             Unplug devices to extend it.",
                            n,
                            if n == 1 { "" } else { "s" },
                            dev_watts,
                            if n == 1 { "is draining" } else { "are draining" },
                            mins_left
                        ),
                    );
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn notify(title: &str, body: &str) {
    let script = format!(
        r#"display notification "{}" with title "{}" sound name "Submarine""#,
        body.replace('"', "'"),
        title.replace('"', "'"),
    );
    let _ = std::process::Command::new("osascript")
        .arg("-e").arg(script)
        .spawn();
}

#[cfg(not(target_os = "macos"))]
fn notify(_title: &str, _body: &str) { /* TODO: Linux/Windows */ }

// ── Background loop ───────────────────────────────────────────────────────────

const TICK_SECS: u64 = 10;

fn start_tray_update_loop(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(TICK_SECS)).await;
            let status = power::get_power_status();
            history::logger_tick(&status, TICK_SECS as f64);
            check_notifications(&status);
            let tooltip = build_tooltip(&status);
            if let Some(tray) = handle.tray_by_id("watts-tray") {
                let _ = tray.set_tooltip(Some(tooltip.as_str()));
            }
        }
    });
}

fn build_tooltip(s: &power::PowerStatus) -> String {
    if s.is_charging {
        let watts = s.watts_in.map(|w| format!("{w:.0}W in")).unwrap_or_default();
        format!("⚡ WattsOrbit · {}% · {}", s.battery_percent, watts)
    } else {
        let time = s.time_remaining_min
            .map(|m| format!(" · {}h {}m left", m / 60, m % 60))
            .unwrap_or_default();
        format!("🔋 WattsOrbit · {}%{}", s.battery_percent, time)
    }
}
