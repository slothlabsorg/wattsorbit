use serde::{Deserialize, Serialize};
use std::process::Command;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsbDevice {
    pub name: String,
    pub manufacturer: Option<String>,
    pub current_ma: Option<u32>,
    pub voltage_mv: Option<u32>,
    pub speed: Option<String>,
    pub is_phone: bool,
    pub is_hub: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerStatus {
    /// True if a charger is physically connected (regardless of whether battery is actively charging)
    pub is_charging: bool,
    /// "charging" | "charged" | "discharging"
    pub charge_state: String,
    pub battery_percent: u8,
    pub time_remaining_min: Option<u32>,
    pub time_to_full_min: Option<u32>,
    pub watts_in: Option<f64>,
    pub watts_out: Option<f64>,
    pub charger_name: Option<String>,
    pub cable_type: Option<String>,
    pub connected_devices: Vec<UsbDevice>,
    pub error: Option<String>,
    // ── Battery health ───────────────────────────────────────────────────────
    /// Full charge cycles completed (from AppleSmartBattery)
    pub cycle_count: Option<u32>,
    /// Battery temperature in °C (raw ioreg Temperature / 100)
    pub temperature_celsius: Option<f64>,
    /// Original factory capacity in mAh
    pub design_capacity_mah: Option<u32>,
    /// Current maximum capacity in mAh (degrades over time)
    pub max_capacity_mah: Option<u32>,
    /// max_capacity / design_capacity × 100, clamped 0–100
    pub health_percent: Option<u8>,
    /// macOS "Optimized Battery Charging" engaged (delays charging past 80% overnight)
    pub optimized_charging: Option<bool>,
}

impl Default for PowerStatus {
    fn default() -> Self {
        Self {
            is_charging: false,
            charge_state: "discharging".into(),
            battery_percent: 0,
            time_remaining_min: None,
            time_to_full_min: None,
            watts_in: None,
            watts_out: None,
            charger_name: None,
            cable_type: None,
            connected_devices: vec![],
            error: None,
            cycle_count: None,
            temperature_celsius: None,
            design_capacity_mah: None,
            max_capacity_mah: None,
            health_percent: None,
            optimized_charging: None,
        }
    }
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_power_status() -> PowerStatus {
    platform::fetch()
}

// ── Platform dispatch ─────────────────────────────────────────────────────────

mod platform {
    use super::*;

    pub fn fetch() -> PowerStatus {
        #[cfg(target_os = "macos")]
        { macos::fetch() }

        #[cfg(target_os = "linux")]
        { linux::fetch() }

        #[cfg(target_os = "windows")]
        { windows::fetch() }

        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        { PowerStatus { error: Some("Unsupported platform".into()), ..Default::default() } }
    }
}

// ── macOS ─────────────────────────────────────────────────────────────────────
#[cfg(target_os = "macos")]
mod macos {
    use super::*;

    pub fn fetch() -> PowerStatus {
        // pmset is the most reliable source for charge state — it abstracts
        // away Apple Silicon vs Intel differences and "charged vs charging".
        let pmset     = run("pmset", &["-g", "batt"]);
        let ioreg     = run("ioreg", &["-l", "-n", "AppleSmartBattery", "-r"]);
        // system_profiler SPUSBDataType fails silently in sandboxed/dev contexts;
        // ioreg -p IOUSB works reliably and shows iPhone UsbPowerSinkCapability.
        let usb_ioreg = run("ioreg", &["-p", "IOUSB", "-l", "-w", "0"]);

        let mut status = parse_ioreg(&pmset, &ioreg);
        status.connected_devices = parse_usb_ioreg(&usb_ioreg);
        status
    }

    fn run(cmd: &str, args: &[&str]) -> String {
        Command::new(cmd)
            .args(args)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default()
    }

    fn extract_str(text: &str, key: &str) -> Option<String> {
        let needle = format!("\"{}\"", key);
        for line in text.lines() {
            let t = line.trim();
            if t.starts_with(&needle) {
                if let Some(pos) = t.find('=') {
                    let val = t[pos + 1..].trim();
                    if val.starts_with('"') && val.ends_with('"') {
                        return Some(val[1..val.len() - 1].to_string());
                    }
                    return Some(val.to_string());
                }
            }
        }
        None
    }

    fn extract_i64(text: &str, key: &str) -> Option<i64> {
        extract_str(text, key).and_then(|v| v.parse().ok())
    }

    // Pull a sub-value from the AdapterDetails inline dict:
    // "AdapterDetails" = {"Watts"=65,"Description"="pd charger","AdapterVoltage"=20000,...}
    fn adapter_field(text: &str, field: &str) -> Option<String> {
        for line in text.lines() {
            // Match the exact "AdapterDetails" key (not AppleRawAdapterDetails)
            if !line.trim().starts_with("\"AdapterDetails\"") { continue; }
            let needle = format!("\"{}\"=", field);
            if let Some(pos) = line.find(&needle) {
                let rest = &line[pos + needle.len()..];
                if rest.starts_with('"') {
                    let end = rest[1..].find('"')?;
                    return Some(rest[1..end + 1].to_string());
                } else {
                    let val: String = rest.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
                    if !val.is_empty() { return Some(val); }
                }
            }
        }
        None
    }

    /// Parse "H:MM remaining" from pmset output.  Returns minutes.
    fn pmset_time(pmset: &str) -> Option<u32> {
        for line in pmset.lines() {
            if let Some(pos) = line.find("remaining") {
                let chunk = line[..pos].trim();
                if let Some(time_str) = chunk.split_whitespace().last() {
                    let parts: Vec<&str> = time_str.split(':').collect();
                    if parts.len() == 2 {
                        let h: u32 = parts[0].parse().ok()?;
                        let m: u32 = parts[1].parse().ok()?;
                        if h > 0 || m > 0 { return Some(h * 60 + m); }
                    }
                }
            }
        }
        None
    }

    fn parse_ioreg(pmset: &str, ioreg: &str) -> PowerStatus {
        if ioreg.is_empty() {
            return PowerStatus { error: Some("Could not read battery info".into()), ..Default::default() };
        }

        // ── Charge state from pmset (most reliable) ───────────────────────────
        // pmset line: "-InternalBattery-0 (id=...): 100%; charged; 0:00 remaining"
        let is_plugged_in        = pmset.contains("'AC Power'");
        let is_actively_charging = pmset.contains("; charging;") || pmset.contains(": charging;");
        // Only "charged" when pmset explicitly says so — NOT when macOS Optimized Battery Charging
        // is holding the battery at 80% (pmset then shows "not charging" / "AC attached").
        let is_explicitly_charged = pmset.contains("; charged;") || pmset.contains(": charged;");
        let charge_state = if !is_plugged_in {
            "discharging"
        } else if is_explicitly_charged {
            "charged"
        } else {
            // includes: actively charging, optimized-charging hold at 80%, AC-attached-not-charging
            "charging"
        }.to_string();

        // Time remaining when discharging; time to full when actively charging
        let pmset_mins = pmset_time(pmset);
        let time_remaining_min = if !is_plugged_in { pmset_mins } else { None };
        let time_to_full_min   = if is_actively_charging { pmset_mins } else { None };

        // ── Battery % from ioreg ──────────────────────────────────────────────
        let current_cap     = extract_i64(ioreg, "CurrentCapacity").unwrap_or(0);
        let max_cap         = extract_i64(ioreg, "MaxCapacity").unwrap_or(100).max(1);
        let battery_percent = ((current_cap * 100) / max_cap).clamp(0, 100) as u8;

        // ── Adapter watts from AdapterDetails ────────────────────────────────
        let watts_in: Option<f64> = adapter_field(ioreg, "Watts")
            .and_then(|w| w.parse().ok());

        let raw_desc = adapter_field(ioreg, "Description");
        let adapter_name = adapter_field(ioreg, "Name"); // set by Apple chargers, empty on 3rd-party
        let adapter_voltage_mv: Option<u32> = adapter_field(ioreg, "AdapterVoltage")
            .and_then(|v| v.parse().ok());

        // Human-readable charger name: prefer Apple's "Name" field, fall back to "Description"
        let charger_name = adapter_name
            .filter(|n| !n.is_empty())
            .or_else(|| raw_desc.as_deref().and_then(|d| {
                if d.eq_ignore_ascii_case("pd charger") || d.is_empty() {
                    watts_in.map(|w| format!("USB-C PD Charger ({:.0}W)", w))
                        .or(Some("USB-C PD Charger".into()))
                } else {
                    Some(d.to_string())
                }
            }))
            .or_else(|| watts_in.map(|w| format!("Charger ({:.0}W)", w)));

        // Cable type from adapter voltage
        let cable_type = adapter_voltage_mv.map(|mv| match mv {
            19_000..=21_000 => "USB-C PD 20V".to_string(),
            14_000..=16_000 => "USB-C PD 15V".to_string(),
            11_000..=13_000 => "USB-C PD 12V".to_string(),
             8_000..=10_000 => "USB-C PD 9V".to_string(),
             4_500..= 5_500 => "USB-C 5V".to_string(),
            _ => format!("{}V", mv / 1000),
        }).or_else(|| {
            charger_name.as_deref().map(|n| {
                if n.contains("MagSafe") { "MagSafe 3".to_string() }
                else if n.contains("USB-C") { "USB-C".to_string() }
                else { "Unknown".to_string() }
            })
        });

        // ── System power draw: battery Amperage × Voltage ────────────────────
        // When charged and plugged in, Amperage = 0 → use adapter watts as proxy.
        let voltage_mv  = extract_i64(ioreg, "Voltage").unwrap_or(0);
        let amperage_ma = extract_i64(ioreg, "Amperage").unwrap_or(0);
        let abs_ma      = amperage_ma.unsigned_abs();
        let watts_out   = if voltage_mv > 0 && abs_ma > 10 {
            Some((voltage_mv as f64 * abs_ma as f64) / 1_000_000.0)
        } else {
            None
        };

        // ── Battery health ────────────────────────────────────────────────
        let cycle_count = extract_i64(ioreg, "CycleCount").map(|v| v as u32);

        // Temperature is stored in units of 0.01 °C in AppleSmartBattery
        let temperature_celsius = extract_i64(ioreg, "Temperature")
            .map(|t| (t as f64) / 100.0);

        // Design capacity and current max capacity (both in mAh)
        let design_capacity_mah = extract_i64(ioreg, "DesignCapacity").map(|v| v as u32);
        // AppleRawMaxCapacity is in actual mAh on Apple Silicon.
        // MaxCapacity is 0-100 on Apple Silicon (percentage units), real mAh on Intel.
        // Use AppleRawMaxCapacity when available for correct mAh display and health %.
        let max_capacity_mah = extract_i64(ioreg, "AppleRawMaxCapacity")
            .or_else(|| extract_i64(ioreg, "MaxCapacity"))
            .map(|v| v as u32);

        // Health = actual_max_mah / design_mah × 100
        let health_percent = match (design_capacity_mah, max_capacity_mah) {
            (Some(d), Some(m)) if d > 0 =>
                Some(((m as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8),
            _ => None,
        };

        // macOS Optimised Battery Charging: field is 0/1 bool in ioreg
        let optimized_charging = extract_i64(ioreg, "OptimizedChargingEngaged")
            .map(|v| v != 0);

        PowerStatus {
            is_charging: is_plugged_in,
            charge_state,
            battery_percent,
            time_remaining_min,
            time_to_full_min,
            watts_in: if is_plugged_in { watts_in } else { None },
            watts_out,
            charger_name: if is_plugged_in { charger_name } else { None },
            cable_type:   if is_plugged_in { cable_type }   else { None },
            connected_devices: vec![],
            error: None,
            cycle_count,
            temperature_celsius,
            design_capacity_mah,
            max_capacity_mah,
            health_percent,
            optimized_charging,
        }
    }

    fn looks_like_hub(name: &str) -> bool {
        let n = name.to_lowercase();
        n.contains("hub") || n.contains("bus") || n.contains("host controller")
            || n.contains("root") || n.contains("interface") || n.contains("xhci")
            || n.contains("ehci") || n.contains("ohci")
    }

    fn looks_like_phone(name: &str, mfr: Option<&str>) -> bool {
        let n = name.to_lowercase();
        let m = mfr.unwrap_or("").to_lowercase();
        n.contains("iphone") || n.contains("ipad") || n.contains("android")
            || n.contains("pixel") || n.contains("galaxy")
            || (m.contains("apple") && (n.contains("iphone") || n.contains("ipad")))
    }

    /// Strip the `  | ` pipe-and-indent prefix that `ioreg -l` puts on every line.
    fn strip_pipe(line: &str) -> &str {
        let s = line.trim_start_matches(' ');
        let s = if s.starts_with('|') { &s[1..] } else { s };
        s.trim_start_matches(' ')
    }

    /// Parse `ioreg -p IOUSB -l -w 0` output.
    /// Each IOUSBHostDevice block starts at a line containing "class IOUSBHostDevice"
    /// and its properties are enclosed in `{ ... }` with a `  | ` prefix on every line.
    fn parse_usb_ioreg(text: &str) -> Vec<UsbDevice> {
        if text.is_empty() { return vec![]; }

        let lines: Vec<&str> = text.lines().collect();
        let mut out = Vec::new();
        let mut i = 0;

        while i < lines.len() {
            if lines[i].contains("class IOUSBHostDevice") {
                // Find the opening '{' (may be on same line or next)
                let mut j = i;
                // Look for the '{' on the device line itself or the very next line
                let open_found = strip_pipe(lines[i]).contains('{') || {
                    j = i + 1;
                    j < lines.len() && strip_pipe(lines[j]).starts_with('{')
                };
                if !open_found {
                    i += 1;
                    continue;
                }
                // Collect property lines until the closing '}'
                let mut props: Vec<String> = Vec::new();
                let mut k = j + 1;
                while k < lines.len() {
                    let t = strip_pipe(lines[k]);
                    if t == "}" || t == "}," { break; }
                    props.push(t.to_string());
                    k += 1;
                }

                let prop_refs: Vec<&str> = props.iter().map(|s| s.as_str()).collect();
                if let Some(dev) = parse_usb_device_props(&prop_refs) {
                    out.push(dev);
                }
                i = k + 1;
                continue;
            }
            i += 1;
        }
        out
    }

    fn parse_usb_device_props(lines: &[&str]) -> Option<UsbDevice> {
        let get_str = |key: &str| -> Option<String> {
            let needle = format!("\"{}\"", key);
            for line in lines {
                // lines are already pipe-stripped
                if line.starts_with(&needle) {
                    if let Some(pos) = line.find(" = ") {
                        let val = line[pos + 3..].trim().trim_end_matches(';').trim();
                        if val.starts_with('"') && val.ends_with('"') {
                            return Some(val[1..val.len() - 1].to_string());
                        }
                        return Some(val.to_string());
                    }
                }
            }
            None
        };
        let get_u64 = |key: &str| -> Option<u64> {
            get_str(key).and_then(|v| v.parse().ok())
        };

        let name = get_str("kUSBProductString")?;
        if name.is_empty() { return None; }
        if looks_like_hub(&name) { return None; }

        let manufacturer = get_str("kUSBVendorString");
        let speed_code   = get_u64("Device Speed");

        // Try Apple power-negotiation field first, then USB descriptor MaxPower,
        // then fall back to USB spec defaults so generic devices don't show 0W.
        let current_ma: Option<u32> = get_u64("UsbPowerSinkCapability")
            .or_else(|| get_u64("MaxPower"))
            .map(|v| v as u32)
            .or_else(|| Some(match speed_code {
                Some(0) | Some(1) => 100,  // USB 1.x low/full-speed
                Some(2)           => 500,  // USB 2.0 high-speed spec max
                _                 => 900,  // USB 3.x spec max
            }));
        let speed = speed_code.map(|code| match code {
            0 => "USB 1.1 (1.5Mbit)".to_string(),
            1 => "USB 1.1 (12Mbit)".to_string(),
            2 => "USB 2.0 (480Mbit)".to_string(),
            3 => "USB 3.2 Gen 1 (5Gbit)".to_string(),
            4 => "USB 3.2 Gen 2 (10Gbit)".to_string(),
            5 => "USB4 (40Gbit)".to_string(),
            _ => format!("USB (speed {})", code),
        });

        let is_phone = looks_like_phone(&name, manufacturer.as_deref());

        Some(UsbDevice {
            name,
            manufacturer,
            current_ma,
            voltage_mv: Some(5000),
            speed,
            is_phone,
            is_hub: false,
        })
    }
}

// ── Linux ─────────────────────────────────────────────────────────────────────
#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn read_file(path: &str) -> Option<String> {
        fs::read_to_string(path).ok().map(|s| s.trim().to_string())
    }

    fn find_battery() -> Option<String> {
        for name in &["BAT0", "BAT1", "BAT2"] {
            let path = format!("/sys/class/power_supply/{}", name);
            if Path::new(&path).exists() {
                return Some(path);
            }
        }
        None
    }

    /// Find whether AC power is online by scanning all power_supply entries
    /// for one with type "Mains".  Returns None if no AC adapter entry is found.
    fn find_ac_online() -> Option<bool> {
        let entries = fs::read_dir("/sys/class/power_supply/").ok()?;
        for entry in entries.flatten() {
            let kind = fs::read_to_string(entry.path().join("type"))
                .unwrap_or_default();
            if kind.trim() != "Mains" { continue; }
            let online = fs::read_to_string(entry.path().join("online"))
                .unwrap_or_default();
            return Some(online.trim() == "1");
        }
        None
    }

    pub fn fetch() -> PowerStatus {
        let Some(bat) = find_battery() else {
            return PowerStatus { error: Some("No battery found".into()), ..Default::default() };
        };

        let capacity: u8 = read_file(&format!("{bat}/capacity"))
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let status_str = read_file(&format!("{bat}/status")).unwrap_or_default();

        // AC adapter path varies: AC, AC0, ACAD, ADP0, ADP1, etc.
        // Scan /sys/class/power_supply/ for any entry with type "Mains".
        let ac_online: bool = find_ac_online().unwrap_or_else(|| {
            // Fallback: trust the battery status string directly.
            matches!(status_str.as_str(), "Charging" | "Full")
        });

        // power_now in microwatts → Watts.
        // Some hardware only exposes current_now (µA) + voltage_now (µV);
        // derive power from those when power_now is absent.
        let power_now: Option<f64> = read_file(&format!("{bat}/power_now"))
            .and_then(|s| s.parse::<u64>().ok())
            .map(|uw| uw as f64 / 1_000_000.0)
            .or_else(|| {
                let ua = read_file(&format!("{bat}/current_now"))
                    .and_then(|s| s.parse::<u64>().ok())?;
                let uv = read_file(&format!("{bat}/voltage_now"))
                    .and_then(|s| s.parse::<u64>().ok())?;
                if ua == 0 || uv == 0 { return None; }
                Some(ua as f64 * uv as f64 / 1_000_000_000_000.0)
            });

        // Time remaining estimate (only meaningful when on battery)
        let time_remaining_min = if !ac_online {
            let energy_now = read_file(&format!("{bat}/energy_now"))
                .and_then(|s| s.parse::<u64>().ok())
                .map(|ue| ue as f64 / 1_000_000.0); // Wh
            // Fallback: charge_now (µAh) × voltage_now (µV) / 10^9 → Wh
            let energy_now = energy_now.or_else(|| {
                let uah = read_file(&format!("{bat}/charge_now"))
                    .and_then(|s| s.parse::<u64>().ok())?;
                let uv  = read_file(&format!("{bat}/voltage_now"))
                    .and_then(|s| s.parse::<u64>().ok())?;
                Some(uah as f64 * uv as f64 / 1_000_000_000_000.0)
            });
            if let (Some(e), Some(p)) = (energy_now, power_now) {
                if p > 0.5 { Some((e / p * 60.0) as u32) } else { None }
            } else { None }
        } else { None };

        // USB devices via lsusb
        let usb_raw = Command::new("lsusb").output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();
        let connected_devices = parse_lsusb(&usb_raw);

        let charge_state = if !ac_online {
            "discharging"
        } else if status_str == "Full" {
            "charged"
        } else {
            "charging"
        }.to_string();

        // Battery health (Linux exposes these in /sys/class/power_supply/BAT*)
        let cycle_count: Option<u32> = read_file(&format!("{bat}/cycle_count"))
            .and_then(|s| s.parse().ok());
        // Temperature is typically in tenths of °C
        let temperature_celsius: Option<f64> = read_file(&format!("{bat}/temp"))
            .and_then(|s| s.parse::<i64>().ok())
            .map(|t| t as f64 / 10.0);
        // charge_full_design and charge_full are in µAh → mAh
        let design_capacity_mah: Option<u32> = read_file(&format!("{bat}/charge_full_design"))
            .and_then(|s| s.parse::<u64>().ok())
            .map(|uah| (uah / 1000) as u32);
        let max_capacity_mah: Option<u32> = read_file(&format!("{bat}/charge_full"))
            .and_then(|s| s.parse::<u64>().ok())
            .map(|uah| (uah / 1000) as u32);
        let health_percent = match (design_capacity_mah, max_capacity_mah) {
            (Some(d), Some(m)) if d > 0 =>
                Some(((m as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8),
            _ => None,
        };

        PowerStatus {
            is_charging: ac_online,
            charge_state,
            battery_percent: capacity,
            time_remaining_min,
            time_to_full_min: None,
            watts_in: if ac_online { power_now } else { None },
            watts_out: power_now,
            charger_name: if ac_online { Some("AC Adapter".into()) } else { None },
            cable_type: None,
            connected_devices,
            error: None,
            cycle_count,
            temperature_celsius,
            design_capacity_mah,
            max_capacity_mah,
            health_percent,
            optimized_charging: None,
        }
    }

    fn parse_lsusb(text: &str) -> Vec<UsbDevice> {
        // "Bus 001 Device 002: ID 05ac:12a8 Apple, Inc. iPhone (PTP mode)"
        text.lines()
            .filter_map(|line| {
                let id_pos = line.find("ID ")?;
                let rest = &line[id_pos + 3..];
                let space = rest.find(' ')?;
                let desc = rest[space..].trim();
                if desc.is_empty() || desc.to_lowercase().contains("hub") { return None; }
                let is_phone = desc.to_lowercase().contains("iphone") || desc.to_lowercase().contains("android");
                Some(UsbDevice {
                    name: desc.to_string(),
                    manufacturer: None,
                    current_ma: Some(500), // lsusb doesn't report current by default
                    voltage_mv: Some(5000),
                    speed: None,
                    is_phone,
                    is_hub: false,
                })
            })
            .collect()
    }
}

// ── Windows ───────────────────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
mod windows {
    use super::*;
    use std::os::windows::process::CommandExt;

    /// Windows CreateProcess flag that prevents a console window from flashing
    /// when we spawn `powershell.exe` for WMI queries. Without this the user
    /// sees a black cmd window pop up every 10 s from the background loop.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// One consolidated PowerShell call that dumps battery + health + USB in
    /// a single child-process spawn. Runs every 10 s, so collapsing 3 spawns
    /// into 1 meaningfully reduces CPU + startup cost.
    ///
    /// Uses Get-CimInstance (modern, faster than Get-WmiObject) and wraps
    /// every query in try/catch so a missing WMI class on older Windows
    /// doesn't abort the whole script.
    const PS_ALL: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
function tc($block) { try { & $block } catch { $null } }

$b = tc { Get-CimInstance Win32_Battery | Select-Object -First 1 }
$a = tc { Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStatus | Select-Object -First 1 }
$s = tc { Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStaticData | Select-Object -First 1 }
$f = tc { Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryFullChargedCapacity | Select-Object -First 1 }
$c = tc { Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryCycleCount | Select-Object -First 1 }
$usb = tc {
  Get-PnpDevice -Class USB -Status OK |
    Where-Object { $_.FriendlyName -notmatch 'Hub|Host|Root|Controller' } |
    Select-Object FriendlyName, Manufacturer
}

@{
  Percent       = if ($b) { [int]$b.EstimatedChargeRemaining } else { 0 }
  RunTime       = if ($b) { [int]$b.EstimatedRunTime } else { 65535 }
  Charging      = if ($a) { [bool]$a.Charging } else { $false }
  Voltage       = if ($a) { [double]$a.Voltage } else { 0 }
  Current       = if ($a) { [double]$a.DischargeRate } else { 0 }
  DesignCap     = if ($s) { [int]$s.DesignedCapacity } else { 0 }
  FullCap       = if ($f) { [int]$f.FullChargedCapacity } else { 0 }
  CycleCount    = if ($c) { [int]$c.CycleCount } else { 0 }
  Usb           = if ($usb) { @($usb) } else { @() }
} | ConvertTo-Json -Depth 4 -Compress
"#;

    fn run_ps(script: &str) -> Option<String> {
        let out = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        if !out.status.success() { return None; }
        Some(String::from_utf8_lossy(&out.stdout).into_owned())
    }

    pub fn fetch() -> PowerStatus {
        let Some(text) = run_ps(PS_ALL) else {
            return PowerStatus { error: Some("PowerShell unavailable".into()), ..Default::default() };
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
            return PowerStatus { error: Some("Could not parse battery info".into()), ..Default::default() };
        };

        let percent  = json["Percent"].as_u64().unwrap_or(0).min(100) as u8;
        let charging = json["Charging"].as_bool().unwrap_or(false);
        // 65535 is WMI's "unknown" sentinel — treat as None
        let run_time = json["RunTime"].as_u64().filter(|&v| v < 65534);

        // BatteryStatus reports mW directly in DischargeRate on most modern laptops.
        // When we can't get that, fall back to V×I. WMI voltage is mV; "Current" here
        // actually holds DischargeRate in mW for robustness across drivers.
        let voltage_mv = json["Voltage"].as_f64().unwrap_or(0.0);
        let mw         = json["Current"].as_f64().unwrap_or(0.0).abs();
        let watts_out  = if mw > 100.0 {
            Some(mw / 1000.0)
        } else if voltage_mv > 0.0 && mw > 0.0 {
            Some((voltage_mv * mw) / 1_000_000.0)
        } else {
            None
        };

        let charge_state = if !charging { "discharging" }
            else if percent >= 100 { "charged" }
            else { "charging" }.to_string();

        let design_capacity_mah = json["DesignCap"].as_u64().filter(|&v| v > 0).map(|v| v as u32);
        let max_capacity_mah    = json["FullCap"].as_u64().filter(|&v| v > 0).map(|v| v as u32);
        let cycle_count         = json["CycleCount"].as_u64().filter(|&v| v > 0).map(|v| v as u32);
        let health_percent = match (design_capacity_mah, max_capacity_mah) {
            (Some(d), Some(m)) if d > 0 =>
                Some(((m as f64 / d as f64) * 100.0).clamp(0.0, 100.0) as u8),
            _ => None,
        };

        let connected_devices = parse_usb(&json["Usb"]);

        PowerStatus {
            is_charging: charging,
            charge_state,
            battery_percent: percent,
            time_remaining_min: run_time.map(|v| v as u32),
            time_to_full_min: None,
            watts_in: if charging { watts_out } else { None },
            watts_out,
            charger_name: if charging { Some("AC Adapter".into()) } else { None },
            cable_type: None,
            connected_devices,
            error: None,
            cycle_count,
            temperature_celsius: None,
            design_capacity_mah,
            max_capacity_mah,
            health_percent,
            optimized_charging: None,
        }
    }

    fn parse_usb(val: &serde_json::Value) -> Vec<UsbDevice> {
        let items: Vec<&serde_json::Value> = if val.is_array() {
            val.as_array().map(|a| a.iter().collect()).unwrap_or_default()
        } else if val.is_object() {
            vec![val]
        } else {
            vec![]
        };

        items.into_iter().filter_map(|item| {
            let name = item["FriendlyName"].as_str()?.to_string();
            let mfr  = item["Manufacturer"].as_str().map(|s| s.to_string());
            let lower = name.to_lowercase();
            let is_phone = lower.contains("iphone") || lower.contains("android");
            Some(UsbDevice {
                name,
                manufacturer: mfr,
                current_ma: Some(500),
                voltage_mv: Some(5000),
                speed: None,
                is_phone,
                is_hub: false,
            })
        }).collect()
    }
}
