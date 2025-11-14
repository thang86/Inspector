// src/layers/l1_headend.rs
// Inspector LIVE L1 Headend Analyzer - TR 101 290, HDR, Dolby Atmos

use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

/// L1 Headend comprehensive metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L1HeadendMetrics {
    pub timestamp_utc: String,
    pub stream_id: String,
    
    // TR 101 290 Errors
    pub tr101290: TR101290Errors,
    
    // Video Quality
    pub video: VideoMetrics,
    
    // Audio Quality
    pub audio: AudioMetrics,
    
    // HDR Metadata
    pub hdr: HDRMetadata,
    
    // Dolby Atmos
    pub atmos: AtmosMetadata,
    
    // Signaling
    pub signaling: SignalingMetrics,
    
    // Alarms
    pub alarms: Vec<L1Alarm>,
}

/// TR 101 290 Priority-based errors (ETSI spec)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TR101290Errors {
    // Priority 1 (Service Outage)
    pub ts_sync_loss: u32,           // 0x47 sync byte lost
    pub pat_error: u32,               // PAT CRC/missing
    pub pmt_error: u32,               // PMT CRC/missing
    pub pid_error: u32,               // Unexpected PID
    pub transport_error: u32,         // transport_error_indicator=1
    
    // Priority 2 (Significant Faults)
    pub crc_error: u32,               // Section CRC failure
    pub pcr_repetition_error: u32,    // PCR interval > 40ms
    pub pcr_accuracy_error: u32,      // |PCR delta - expected| > 500µs
    pub pts_error: u32,               // PTS/DTS inversion
    pub cat_error: u32,               // CAT error (if present)
    pub mpeg_frame_error: u32,        // ES framing error
    
    // Priority 3 (Minor Issues)
    pub unreferenced_pid: u32,        // PID in PMT but no packets
    pub pid_conflict: u32,            // Same PID different types
    pub unused_pid: u32,              // PID received, not in PMT
    pub slow_bitrate: u32,            // Bitrate below expected
}

/// Video quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetrics {
    pub codec: VideoCodec,
    pub resolution: (u32, u32),       // (width, height)
    pub fps: f32,
    pub bitrate_kbps: u32,
    pub bitrate_min_kbps: u32,
    pub bitrate_max_kbps: u32,
    pub bitrate_avg_kbps: u32,
    
    pub gop_length: u32,              // In frames
    pub gop_min: u32,
    pub gop_max: u32,
    pub gop_closed: bool,             // Closed/Open GOP
    
    pub mos_score: f32,               // 1-5 scale
    pub macroblocking_ratio: f32,     // 0-1
    pub freeze_frame_detected: bool,
    pub black_frame_detected: bool,
    pub banding_detected: bool,
    
    pub frame_drop_count: u32,
    pub frame_repeat_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VideoCodec {
    MPEG2,
    H264,
    HEVC,
    AV1,
}

/// Audio quality metrics (BS-1770-3 loudness measurement)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetrics {
    pub codec: AudioCodec,
    pub channels: u8,
    pub sample_rate_hz: u32,
    pub bitrate_kbps: u32,
    
    // Loudness (BS-1770-3)
    pub loudness_lufs: f32,           // -23.0 target (broadcast)
    pub loudness_range_lu: f32,
    pub true_peak_dbfs: f32,
    pub true_peak_max_dbfs: f32,
    
    // Stereo (L/R)
    pub left_channel_present: bool,
    pub right_channel_present: bool,
    pub stereo_correlation: f32,      // 0-1 (1=mono, 0=inverted)
    
    // Quality
    pub silence_detected: bool,
    pub silence_duration_ms: u32,
    pub clipping_detected: bool,
    pub clipping_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AudioCodec {
    MPEGAudio,
    AC3,
    EAC3,
    AAC,
    HEAAC,
}

/// HDR Metadata (HEVC SEI - Main10 Profile)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HDRMetadata {
    pub hdr_enabled: bool,
    pub transfer_function: TransferFunction,
    pub color_space: ColorSpace,
    
    // Master Display Color Volume (MDCV)
    pub display_primaries: Option<DisplayPrimaries>,
    pub white_point: Option<(u16, u16)>,
    pub max_display_mastering_luminance: Option<u32>,  // nits
    pub min_display_mastering_luminance: Option<u32>,
    
    // Content Light Level (CLL)
    pub max_cll: Option<u16>,         // Max frame content light level
    pub max_fall: Option<u16>,        // Max average frame light level
    
    // Consistency
    pub metadata_consistent: bool,
    pub metadata_change_count: u32,
    pub last_sei_time_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TransferFunction {
    BT709,
    BT2020,
    HDR10,      // PQ (Perceptual Quantizer)
    HLG,        // Hybrid Log Gamma
    SDR,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ColorSpace {
    BT709,
    BT2020,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayPrimaries {
    pub green_x: u16,
    pub green_y: u16,
    pub blue_x: u16,
    pub blue_y: u16,
    pub red_x: u16,
    pub red_y: u16,
}

/// Dolby Digital+/Atmos Metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtmosMetadata {
    pub dolby_digital_plus_present: bool,
    pub ac4_present: bool,            // AC-4 (next-gen)
    
    // Atmos specifics
    pub immersive_audio_present: bool,
    pub joc_present: bool,            // Joint Object Codec
    pub atmos_objects: u32,
    pub atmos_beds: u32,
    
    // Loudness per object
    pub object_loudness_lufs_list: Vec<f32>,
    pub bed_loudness_lufs: f32,
    
    // Metadata continuity
    pub metadata_consistent: bool,
    pub metadata_loss_events: u32,
}

/// Signaling (SCTE-35, Closed Caption, etc)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalingMetrics {
    // SCTE-35
    pub scte35_splice_count: u32,
    pub scte35_missing_count: u32,
    pub scte35_crc_error_count: u32,
    pub scte35_last_event: Option<SCTE35Event>,
    
    // Closed Caption (CEA-608/708)
    pub caption_frames_received: u32,
    pub caption_crc_errors: u32,
    pub caption_field_errors: u32,
    
    // NIT/SDT
    pub nit_present: bool,
    pub sdt_present: bool,
    pub nit_crc_errors: u32,
    pub sdt_crc_errors: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SCTE35Event {
    pub event_id: u32,
    pub pts: u64,
    pub duration_ms: u32,
    pub splice_type: String,          // "In", "Out", "Cancel"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L1Alarm {
    pub alarm_type: AlarmType,
    pub severity: Severity,
    pub message: String,
    pub timestamp_utc: String,
    pub value: f32,
    pub threshold: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    Major,
    Minor,
    Info,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AlarmType {
    // Video
    MacroblockingHigh,
    MoSLow,
    FreezeFrame,
    BlackFrame,
    GOPLengthAbnormal,
    
    // Audio
    AudioSilence,
    LoudnessOutOfRange,
    TruePeakExceeded,
    ChannelMissing,
    
    // HDR
    HDRMetadataMissing,
    HDRMetadataInconsistent,
    
    // Atmos
    AtmosJocError,
    AtmosLoudnessError,
    
    // TS
    TS_SyncLoss,
    PATError,
    PMTError,
    PCRDrift,
    DTSError,
    
    // Signaling
    SCTE35Missing,
    CaptionError,
}

/// L1 Headend Analyzer
pub struct L1HeadendAnalyzer {
    stream_id: String,
    metrics: Arc<RwLock<L1HeadendMetrics>>,
    config: L1HeadendConfig,
}

#[derive(Debug, Clone)]
pub struct L1HeadendConfig {
    pub tr101290_enabled: bool,
    pub video_mos_enabled: bool,
    pub hdr_monitoring_enabled: bool,
    pub atmos_monitoring_enabled: bool,
    pub loudness_target_lufs: f32,
    pub loudness_tolerance_db: f32,
    pub macroblocking_threshold: f32,
}

impl L1HeadendAnalyzer {
    pub fn new(stream_id: String, config: L1HeadendConfig) -> Self {
        let metrics = L1HeadendMetrics {
            timestamp_utc: chrono::Utc::now().to_rfc3339(),
            stream_id: stream_id.clone(),
            tr101290: TR101290Errors::default(),
            video: VideoMetrics {
                codec: VideoCodec::HEVC,
                resolution: (1920, 1080),
                fps: 25.0,
                bitrate_kbps: 15000,
                bitrate_min_kbps: 15000,
                bitrate_max_kbps: 15000,
                bitrate_avg_kbps: 15000,
                gop_length: 25,
                gop_min: 25,
                gop_max: 25,
                gop_closed: true,
                mos_score: 4.5,
                macroblocking_ratio: 0.0,
                freeze_frame_detected: false,
                black_frame_detected: false,
                banding_detected: false,
                frame_drop_count: 0,
                frame_repeat_count: 0,
            },
            audio: AudioMetrics {
                codec: AudioCodec::EAC3,
                channels: 2,
                sample_rate_hz: 48000,
                bitrate_kbps: 384,
                loudness_lufs: -23.0,
                loudness_range_lu: 8.0,
                true_peak_dbfs: -0.5,
                true_peak_max_dbfs: 1.0,
                left_channel_present: true,
                right_channel_present: true,
                stereo_correlation: 0.85,
                silence_detected: false,
                silence_duration_ms: 0,
                clipping_detected: false,
                clipping_count: 0,
            },
            hdr: HDRMetadata {
                hdr_enabled: true,
                transfer_function: TransferFunction::HDR10,
                color_space: ColorSpace::BT2020,
                display_primaries: None,
                white_point: None,
                max_display_mastering_luminance: Some(1000),
                min_display_mastering_luminance: Some(0),
                max_cll: Some(1000),
                max_fall: Some(500),
                metadata_consistent: true,
                metadata_change_count: 0,
                last_sei_time_ms: 0,
            },
            atmos: AtmosMetadata {
                dolby_digital_plus_present: true,
                ac4_present: false,
                immersive_audio_present: true,
                joc_present: true,
                atmos_objects: 16,
                atmos_beds: 2,
                object_loudness_lufs_list: vec![-23.0; 16],
                bed_loudness_lufs: -23.0,
                metadata_consistent: true,
                metadata_loss_events: 0,
            },
            signaling: SignalingMetrics {
                scte35_splice_count: 0,
                scte35_missing_count: 0,
                scte35_crc_error_count: 0,
                scte35_last_event: None,
                caption_frames_received: 0,
                caption_crc_errors: 0,
                caption_field_errors: 0,
                nit_present: true,
                sdt_present: true,
                nit_crc_errors: 0,
                sdt_crc_errors: 0,
            },
            alarms: vec![],
        };
        
        Self {
            stream_id,
            metrics: Arc::new(RwLock::new(metrics)),
            config,
        }
    }
    
    /// Analyze TR 101 290 errors
    pub async fn check_tr101290(&self, ts_packet: &[u8]) -> Option<L1Alarm> {
        let mut metrics = self.metrics.write().await;
        
        // Check TS sync byte
        if ts_packet.is_empty() || ts_packet[0] != 0x47 {
            metrics.tr101290.ts_sync_loss += 1;
            
            let alarm = L1Alarm {
                alarm_type: AlarmType::TS_SyncLoss,
                severity: Severity::Critical,
                message: "TS sync byte lost (0x47)".to_string(),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                value: metrics.tr101290.ts_sync_loss as f32,
                threshold: 1.0,
            };
            
            metrics.alarms.push(alarm.clone());
            return Some(alarm);
        }
        
        None
    }
    
    /// Analyze audio loudness (BS-1770-3)
    pub async fn analyze_loudness(&self, lufs: f32) {
        let mut metrics = self.metrics.write().await;
        metrics.audio.loudness_lufs = lufs;
        
        let deviation = (lufs - self.config.loudness_target_lufs).abs();
        
        if deviation > self.config.loudness_tolerance_db + 1.0 {
            let alarm = L1Alarm {
                alarm_type: AlarmType::LoudnessOutOfRange,
                severity: if deviation > self.config.loudness_tolerance_db + 2.0 {
                    Severity::Critical
                } else {
                    Severity::Major
                },
                message: format!("Audio loudness {:.1} LUFS (target: {:.1})", 
                    lufs, self.config.loudness_target_lufs),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                value: lufs,
                threshold: self.config.loudness_target_lufs,
            };
            
            metrics.alarms.push(alarm);
        }
    }
    
    /// Analyze HDR metadata (HEVC SEI)
    pub async fn analyze_hdr_metadata(&self, sei_present: bool, max_cll: Option<u16>) {
        let mut metrics = self.metrics.write().await;
        
        if !sei_present {
            metrics.hdr.metadata_consistent = false;
            metrics.hdr.metadata_change_count += 1;
            
            let alarm = L1Alarm {
                alarm_type: AlarmType::HDRMetadataMissing,
                severity: Severity::Major,
                message: "HDR metadata (SEI) missing or incomplete".to_string(),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                value: 0.0,
                threshold: 1.0,
            };
            
            metrics.alarms.push(alarm);
        } else {
            metrics.hdr.max_cll = max_cll;
            metrics.hdr.metadata_consistent = true;
        }
    }
    
    /// Analyze Dolby Atmos JOC
    pub async fn analyze_atmos_joc(&self, joc_valid: bool, object_count: u32) {
        let mut metrics = self.metrics.write().await;
        
        if !joc_valid {
            metrics.atmos.metadata_loss_events += 1;
            
            let alarm = L1Alarm {
                alarm_type: AlarmType::AtmosJocError,
                severity: Severity::Major,
                message: "Dolby Atmos JOC frame error".to_string(),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                value: metrics.atmos.metadata_loss_events as f32,
                threshold: 0.0,
            };
            
            metrics.alarms.push(alarm);
        } else {
            metrics.atmos.atmos_objects = object_count;
        }
    }
    
    /// Detect SCTE-35 splice events
    pub async fn detect_scte35(&self, splice_present: bool) {
        let mut metrics = self.metrics.write().await;
        
        if splice_present {
            metrics.signaling.scte35_splice_count += 1;
        } else {
            metrics.signaling.scte35_missing_count += 1;
            
            if metrics.signaling.scte35_missing_count > 5 {
                let alarm = L1Alarm {
                    alarm_type: AlarmType::SCTE35Missing,
                    severity: Severity::Major,
                    message: "SCTE-35 splice points missing".to_string(),
                    timestamp_utc: chrono::Utc::now().to_rfc3339(),
                    value: metrics.signaling.scte35_missing_count as f32,
                    threshold: 5.0,
                };
                
                metrics.alarms.push(alarm);
            }
        }
    }
    
    /// Get current metrics
    pub async fn get_metrics(&self) -> L1HeadendMetrics {
        self.metrics.read().await.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_tr101290_sync_loss() {
        let config = L1HeadendConfig {
            tr101290_enabled: true,
            video_mos_enabled: true,
            hdr_monitoring_enabled: true,
            atmos_monitoring_enabled: true,
            loudness_target_lufs: -23.0,
            loudness_tolerance_db: 2.0,
            macroblocking_threshold: 0.15,
        };
        
        let analyzer = L1HeadendAnalyzer::new("CH001".to_string(), config);
        
        // Invalid TS packet (missing 0x47 sync)
        let invalid_ts = vec![0xFF; 188];
        let alarm = analyzer.check_tr101290(&invalid_ts).await;
        
        assert!(alarm.is_some());
        assert_eq!(alarm.unwrap().alarm_type, AlarmType::TS_SyncLoss);
    }
    
    #[tokio::test]
    async fn test_loudness_monitoring() {
        let config = L1HeadendConfig {
            tr101290_enabled: true,
            video_mos_enabled: true,
            hdr_monitoring_enabled: true,
            atmos_monitoring_enabled: true,
            loudness_target_lufs: -23.0,
            loudness_tolerance_db: 2.0,
            macroblocking_threshold: 0.15,
        };
        
        let analyzer = L1HeadendAnalyzer::new("CH001".to_string(), config);
        
        // Test out-of-spec loudness
        analyzer.analyze_loudness(-26.0).await;
        
        let metrics = analyzer.get_metrics().await;
        assert!(!metrics.alarms.is_empty());
    }
}
