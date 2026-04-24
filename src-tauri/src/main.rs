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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(tauri::generate_handler![
            power::get_power_status,
            history::get_today_stats,
            hide_window,
            get_autostart,
            set_autostart,
        ])
        .setup(|app| {
            configure_popup(app);
            setup_tray(app)?;
            start_tray_update_loop(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running WattsOrbit");
}

// ── Popup window configuration ────────────────────────────────────────────────

fn configure_popup(app: &mut tauri::App) {
    let Some(win) = app.get_webview_window("main") else { return };

    // Visible on all workspaces (sets NSWindowCollectionBehaviorCanJoinAllSpaces)
    let _ = win.set_visible_on_all_workspaces(true);

    // macOS: set NSStatusWindowLevel (25) + NSWindowCollectionBehaviorFullScreenAuxiliary
    // so the popup floats above fullscreen app spaces, not just regular desktop spaces.
    #[cfg(target_os = "macos")]
    set_macos_popup_level(&win);

    // Auto-hide when the popup loses focus (click outside).
    // LAST_HIDE_MS debounce (250 ms) prevents the popup immediately re-opening
    // when the same tray-icon click that dismissed it fires the left-click event.
    let win_blur = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            *LAST_HIDE_MS.lock().unwrap() = now_ms();
            let _ = win_blur.hide();
        }
    });
}

#[cfg(target_os = "macos")]
fn set_macos_popup_level(win: &tauri::WebviewWindow) {
    use objc::{msg_send, sel, sel_impl, runtime::Object};
    if let Ok(ns_win_ptr) = win.ns_window() {
        let ns_win = ns_win_ptr as *mut Object;
        unsafe {
            // NSStatusWindowLevel = 25  →  floats above fullscreen spaces
            let _: () = msg_send![ns_win, setLevel: 25_i64];
            // CanJoinAllSpaces(1) | Transient(8) | IgnoresCycle(64) | FullScreenAuxiliary(256)
            let behavior: u64 = 1 | 8 | 64 | 256;
            let _: () = msg_send![ns_win, setCollectionBehavior: behavior];
        }
    }
}

/// Activate the WattsOrbit process and bring the popup to the front.
///
/// `window.show()` alone only works when the app is already the frontmost
/// application.  When the user is in a fullscreen space, the fullscreen app
/// owns that role, so the popup would silently appear behind it.
/// Calling `activateIgnoringOtherApps: YES` + `makeKeyAndOrderFront:` first
/// forces macOS to switch the active application and place the window on the
/// current space — the same technique used by Alfred, Raycast, and similar
/// menu-bar popup apps.
#[cfg(target_os = "macos")]
fn activate_popup(win: &tauri::WebviewWindow) {
    use objc::{msg_send, sel, sel_impl, runtime::Object};
    unsafe {
        // Bring WattsOrbit to the front even if another app is fullscreen.
        let cls = objc::runtime::Class::get("NSApplication")
            .expect("NSApplication class not found");
        let app: *mut Object = msg_send![cls, sharedApplication];
        let _: () = msg_send![app, activateIgnoringOtherApps: 1_i8];
    }
    if let Ok(ns_win_ptr) = win.ns_window() {
        let ns_win = ns_win_ptr as *mut Object;
        unsafe {
            let nil: *mut Object = std::ptr::null_mut();
            let _: () = msg_send![ns_win, makeKeyAndOrderFront: nil];
        }
    }
}

/// Tracks the last time the popup was hidden — used for debounce in tray click.
static LAST_HIDE_MS: Mutex<u64> = Mutex::new(0);

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    *LAST_HIDE_MS.lock().unwrap() = now_ms();
    let _ = window.hide();
}

#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(enabled: bool, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
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
                    *LAST_HIDE_MS.lock().unwrap() = now_ms();
                    let _ = window.hide();
                    return;
                }

                // If the window was just hidden by the blur triggered by this
                // same tray-icon click, skip re-opening (prevents flicker loop).
                if now_ms().saturating_sub(*LAST_HIDE_MS.lock().unwrap()) < 250 {
                    return;
                }

                let w = 380_f64;
                let x = position.x - w / 2.0;
                let y = position.y + 8.0;
                let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                let _ = window.show();
                // Activate the app so the popup appears on the current space,
                // including above fullscreen app spaces.
                #[cfg(target_os = "macos")]
                activate_popup(&window);
                let _ = window.set_focus();
            }
        })
        .build(app)?;
    Ok(())
}

// ── Notification state ────────────────────────────────────────────────────────

/// Battery percentage at which to alert the user to stop charging.
const CHARGE_LIMIT_PCT: u8 = 80;
/// Minutes at or above CHARGE_LIMIT_PCT while charging before sending the sustained alert.
const HIGH_CHARGE_MINUTES: u64 = 30;

struct NotifState {
    last_weak_charger:   Option<Instant>,
    last_low_battery:    Option<Instant>,
    last_charge_limit:   Option<Instant>,
    last_sustained:      Option<Instant>,
    weak_charger_ticks:  u32,
    /// When the battery first reached CHARGE_LIMIT_PCT while still charging.
    high_charge_since:   Option<Instant>,
    /// True once we've fired the at-limit notification this session (reset on unplug).
    limit_notified:      bool,
}

static NOTIF: Mutex<NotifState> = Mutex::new(NotifState {
    last_weak_charger:  None,
    last_low_battery:   None,
    last_charge_limit:  None,
    last_sustained:     None,
    weak_charger_ticks: 0,
    high_charge_since:  None,
    limit_notified:     false,
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
        // ── Charge-limit reached ──────────────────────────────────────────
        // Fire once per charging session when battery hits CHARGE_LIMIT_PCT.
        if status.battery_percent >= CHARGE_LIMIT_PCT && !st.limit_notified
            && due(st.last_charge_limit)
        {
            st.last_charge_limit = Some(now);
            st.limit_notified = true;
            notify(
                "WattsOrbit — Charge limit reached",
                &format!(
                    "Battery at {}%. Consider unplugging — staying above 80% long-term accelerates wear.",
                    status.battery_percent
                ),
            );
        }

        // ── Sustained high charge ─────────────────────────────────────────
        if status.battery_percent >= CHARGE_LIMIT_PCT {
            if st.high_charge_since.is_none() { st.high_charge_since = Some(now); }
            if let Some(since) = st.high_charge_since {
                let mins = now.duration_since(since).as_secs() / 60;
                if mins >= HIGH_CHARGE_MINUTES && due(st.last_sustained) {
                    st.last_sustained = Some(now);
                    notify(
                        "WattsOrbit — Still at high charge",
                        &format!(
                            "Plugged in above {}% for {} min. Unplug to extend long-term battery life.",
                            CHARGE_LIMIT_PCT, mins
                        ),
                    );
                }
            }
        } else {
            st.high_charge_since = None;
        }
    } else {
        st.weak_charger_ticks = 0;
        // Reset per-session state when unplugged
        st.limit_notified    = false;
        st.high_charge_since = None;

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
