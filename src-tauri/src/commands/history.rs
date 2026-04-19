use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::{DateTime, Datelike, Local};
use super::power::PowerStatus;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDraw {
    pub name: String,
    pub watts: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerSample {
    pub timestamp_secs: i64,
    pub watts_in: Option<f64>,
    pub watts_out: Option<f64>,
    /// Per-device USB draw at this moment
    pub devices: Vec<DeviceDraw>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChargeSession {
    pub charger_name: String,
    pub cable_type: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub wh_delivered: f64,
    pub peak_watts: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceStat {
    pub name: String,
    pub manufacturer: Option<String>,
    pub wh_drawn: f64,
    pub battery_impact_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TodayStats {
    pub wh_charged: f64,
    pub wh_consumed: f64,
    pub seconds_plugged_in: u32,
    pub charge_sessions: Vec<ChargeSession>,
    pub device_stats: Vec<DeviceStat>,
    pub samples: Vec<PowerSample>,
}

// ── Internal logger ───────────────────────────────────────────────────────────

struct ActiveSession {
    charger_name: String,
    cable_type: Option<String>,
    started_at: DateTime<Local>,
    wh_delivered: f64,
    peak_watts: f64,
}

struct DeviceAccum {
    name: String,
    manufacturer: Option<String>,
    wh_drawn: f64,
}

const MAX_SAMPLES: usize = 720; // 2 hours at 10-second ticks

pub struct PowerLogger {
    day: u32,
    wh_charged: f64,
    wh_consumed: f64,
    seconds_plugged_in: u32,
    active_session: Option<ActiveSession>,
    completed_sessions: Vec<ChargeSession>,
    device_accum: Vec<DeviceAccum>,
    samples: Vec<PowerSample>,
}

impl PowerLogger {
    fn new() -> Self {
        Self {
            day: Local::now().day(),
            wh_charged: 0.0,
            wh_consumed: 0.0,
            seconds_plugged_in: 0,
            active_session: None,
            completed_sessions: Vec::new(),
            device_accum: Vec::new(),
            samples: Vec::new(),
        }
    }

    pub fn tick(&mut self, status: &PowerStatus, interval_secs: f64) {
        let frac_hr = interval_secs / 3600.0;

        if Local::now().day() != self.day {
            *self = Self::new();
        }

        // Record sample with per-device draws
        let device_draws: Vec<DeviceDraw> = status.connected_devices.iter().map(|d| {
            // current_ma is always populated now (spec defaults in power.rs),
            // but keep a sensible fallback here just in case.
            let ma = d.current_ma.unwrap_or(500) as f64;
            DeviceDraw {
                name: d.name.clone(),
                watts: ma * d.voltage_mv.unwrap_or(5000) as f64 / 1_000_000.0,
            }
        }).collect();

        self.samples.push(PowerSample {
            timestamp_secs: Local::now().timestamp(),
            watts_in: status.watts_in,
            watts_out: status.watts_out,
            devices: device_draws,
        });
        if self.samples.len() > MAX_SAMPLES {
            self.samples.remove(0);
        }

        if let Some(w) = status.watts_out {
            self.wh_consumed += w * frac_hr;
        }

        if status.is_charging {
            self.seconds_plugged_in += interval_secs as u32;
            let charger_name = status.charger_name.clone()
                .unwrap_or_else(|| "Unknown Charger".to_string());

            if let Some(w) = status.watts_in {
                self.wh_charged += w * frac_hr;
                match self.active_session.as_mut() {
                    Some(sess) if sess.charger_name == charger_name => {
                        sess.wh_delivered += w * frac_hr;
                        if w > sess.peak_watts { sess.peak_watts = w; }
                    }
                    _ => {
                        self.close_active_session();
                        self.active_session = Some(ActiveSession {
                            charger_name,
                            cable_type: status.cable_type.clone(),
                            started_at: Local::now(),
                            wh_delivered: w * frac_hr,
                            peak_watts: w,
                        });
                    }
                }
            }
        } else {
            self.close_active_session();
        }

        for dev in &status.connected_devices {
            let ma = dev.current_ma.unwrap_or(500) as f64;
            let wh = ma * dev.voltage_mv.unwrap_or(5000) as f64
                / 1_000_000.0 * frac_hr;
            if let Some(acc) = self.device_accum.iter_mut().find(|a| a.name == dev.name) {
                acc.wh_drawn += wh;
            } else {
                self.device_accum.push(DeviceAccum {
                    name: dev.name.clone(),
                    manufacturer: dev.manufacturer.clone(),
                    wh_drawn: wh,
                });
            }
        }
    }

    fn close_active_session(&mut self) {
        if let Some(sess) = self.active_session.take() {
            self.completed_sessions.push(ChargeSession {
                charger_name: sess.charger_name,
                cable_type: sess.cable_type,
                started_at: sess.started_at.to_rfc3339(),
                ended_at: Some(Local::now().to_rfc3339()),
                wh_delivered: sess.wh_delivered,
                peak_watts: sess.peak_watts,
            });
        }
    }

    pub fn today_stats(&self) -> TodayStats {
        let mut sessions = self.completed_sessions.clone();
        if let Some(sess) = &self.active_session {
            sessions.push(ChargeSession {
                charger_name: sess.charger_name.clone(),
                cable_type: sess.cable_type.clone(),
                started_at: sess.started_at.to_rfc3339(),
                ended_at: None,
                wh_delivered: sess.wh_delivered,
                peak_watts: sess.peak_watts,
            });
        }

        let total_consumed = self.wh_consumed.max(0.01);
        let device_stats = self.device_accum.iter().map(|acc| DeviceStat {
            name: acc.name.clone(),
            manufacturer: acc.manufacturer.clone(),
            wh_drawn: acc.wh_drawn,
            battery_impact_pct: (acc.wh_drawn / total_consumed * 100.0).min(100.0),
        }).collect();

        TodayStats {
            wh_charged: self.wh_charged,
            wh_consumed: self.wh_consumed,
            seconds_plugged_in: self.seconds_plugged_in,
            charge_sessions: sessions,
            device_stats,
            samples: self.samples.clone(),
        }
    }
}

// ── Global logger ─────────────────────────────────────────────────────────────

static LOGGER: Mutex<Option<PowerLogger>> = Mutex::new(None);

pub fn logger_tick(status: &PowerStatus, interval_secs: f64) {
    if let Ok(mut guard) = LOGGER.lock() {
        let logger = guard.get_or_insert_with(PowerLogger::new);
        logger.tick(status, interval_secs);
    }
}

#[tauri::command]
pub fn get_today_stats() -> TodayStats {
    LOGGER.lock()
        .ok()
        .and_then(|g| g.as_ref().map(|l| l.today_stats()))
        .unwrap_or_default()
}
