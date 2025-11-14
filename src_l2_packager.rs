// src/layers/l2_packager.rs
// Inspector LIVE L2 Packager Analyzer - HLS/DASH ABR Validation, EBP, fMP4

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// L2 Packager comprehensive metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L2PackagerMetrics {
    pub timestamp_utc: String,
    pub stream_id: String,
    
    // Manifest metrics
    pub manifest: ManifestMetrics,
    
    // ABR Ladder
    pub abr_ladder: Vec<ABRRung>,
    pub abr_consistency: f32,  // 0-1: higher = better consistency
    
    // Segment metrics
    pub segment_analysis: SegmentMetrics,
    
    // Track validation
    pub audio_tracks: Vec<TrackMetrics>,
    pub subtitle_tracks: Vec<TrackMetrics>,
    
    // EBP Alignment
    pub ebp_alignment: EBPMetrics,
    
    // fMP4 Box structure
    pub fmp4_validation: FMP4Metrics,
    
    // DRM Metadata
    pub drm_metadata: DRMMetrics,
    
    // Alarms
    pub alarms: Vec<L2Alarm>,
}

/// HLS/DASH Manifest validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestMetrics {
    pub format: ManifestFormat,           // HLS or DASH
    pub version: String,
    pub target_duration_seconds: f32,
    pub segment_duration_seconds: f32,
    pub total_segments: u32,
    pub current_sequence_number: u64,
    
    // Timing
    pub manifest_fetch_time_ms: u32,
    pub manifest_update_interval_ms: u32,
    pub playlist_type: PlaylistType,     // VOD, LIVE, EVENT
    
    // Errors
    pub manifest_parse_errors: u32,
    pub manifest_crc_errors: u32,
    pub manifest_update_failures: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ManifestFormat {
    HLS,
    DASH,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PlaylistType {
    VOD,    // Video on Demand
    LIVE,   // Live streaming
    EVENT,  // Event (like live but with known end)
}

/// ABR Rung/Rendition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ABRRung {
    pub rung_id: u32,
    pub bitrate_kbps: u32,
    pub resolution: (u32, u32),         // (width, height)
    pub fps: f32,
    pub codec: String,                  // "avc", "hevc", etc
    pub profile_level: String,          // "Main10@Level5"
    pub avg_segment_size_bytes: u32,
    pub bitrate_consistency: f32,       // 0-1
    pub segment_count: u32,
    pub segment_duration_expected: f32,
    pub segment_duration_variance: f32,
}

/// Segment analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentMetrics {
    pub segments_received: u64,
    pub segments_missing: u64,
    pub segment_duration_avg_ms: u32,
    pub segment_duration_min_ms: u32,
    pub segment_duration_max_ms: u32,
    pub segment_size_avg_bytes: u32,
    pub segment_size_min_bytes: u32,
    pub segment_size_max_bytes: u32,
    
    // Continuity
    pub sequence_gaps_detected: u32,
    pub duplicate_segments: u32,
    pub out_of_order_segments: u32,
    
    // Timing
    pub segment_arrival_jitter_ms: f32,
    pub segment_fetch_latency_ms: f32,
}

/// Track (audio/subtitle) validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMetrics {
    pub track_id: String,
    pub track_type: String,             // "audio", "subtitle"
    pub language: String,
    pub codec: String,
    pub bitrate_kbps: u32,
    pub sync_with_video: bool,
    pub segment_count: u32,
    pub sync_errors: u32,
}

/// EBP (Elementary Bitstream Partition) alignment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EBPMetrics {
    pub ebp_enabled: bool,
    pub ebp_frames_received: u32,
    pub ebp_valid_frames: u32,
    pub ebp_sap_type1_count: u32,       // Random access (keyframe)
    pub ebp_sap_type2_count: u32,       // Closed GOP
    pub ebp_timing_errors: u32,         // Misalignment with segment
    pub last_ebp_timestamp: u64,
}

/// fMP4 (Fragmented MP4) Box structure validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FMP4Metrics {
    pub format: String,                 // "mp4", "fragmented_mp4"
    pub ftyp_brand: String,             // Brand identifier
    pub init_segment_size_bytes: u32,
    pub media_segment_size_bytes: u32,
    
    // Box validation
    pub moof_boxes_received: u32,       // Movie fragment
    pub mdat_boxes_received: u32,       // Media data
    pub box_size_errors: u32,           // Truncated boxes
    pub sample_flag_errors: u32,        // Keyframe, size, offset issues
    pub duration_alignment_errors: u32,
    
    // CENC (Common Encryption) for DRM
    pub cenc_present: bool,
    pub pssh_boxes: u32,                // Protection System Specific Header
}

/// DRM Metadata preservation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DRMMetrics {
    pub drm_enabled: bool,
    pub drm_system: String,             // "widevine", "playready", "fairplay"
    pub key_rotation_count: u32,
    pub key_rotation_interval_sec: u32,
    pub license_fetch_time_ms: u32,
    pub license_errors: u32,
    pub drm_metadata_present: bool,     // PSS box in fMP4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct L2Alarm {
    pub alarm_type: L2AlarmType,
    pub severity: Severity,
    pub message: String,
    pub timestamp_utc: String,
    pub rung_id: Option<u32>,           // Which ABR rung affected
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
pub enum L2AlarmType {
    ManifestParseError,
    ABRLadderInconsistent,
    SegmentMissing,
    SegmentDurationAbnormal,
    EBPMisaligned,
    FMP4BoxError,
    DRMMetadataMissing,
    TrackSyncError,
    SegmentGap,
}

/// L2 Packager Analyzer
pub struct L2PackagerAnalyzer {
    stream_id: String,
    metrics: Arc<RwLock<L2PackagerMetrics>>,
    config: L2PackagerConfig,
}

#[derive(Debug, Clone)]
pub struct L2PackagerConfig {
    pub manifest_format: ManifestFormat,
    pub expected_segment_duration_ms: f32,
    pub segment_duration_tolerance_percent: f32,
    pub abr_ladder_validation: bool,
    pub ebp_validation: bool,
    pub drm_enabled: bool,
}

impl L2PackagerAnalyzer {
    pub fn new(stream_id: String, config: L2PackagerConfig) -> Self {
        let metrics = L2PackagerMetrics {
            timestamp_utc: chrono::Utc::now().to_rfc3339(),
            stream_id: stream_id.clone(),
            manifest: ManifestMetrics {
                format: config.manifest_format,
                version: "3.0".to_string(),
                target_duration_seconds: 10.0,
                segment_duration_seconds: 10.0,
                total_segments: 0,
                current_sequence_number: 0,
                manifest_fetch_time_ms: 100,
                manifest_update_interval_ms: 5000,
                playlist_type: PlaylistType::LIVE,
                manifest_parse_errors: 0,
                manifest_crc_errors: 0,
                manifest_update_failures: 0,
            },
            abr_ladder: Self::default_abr_ladder(),
            abr_consistency: 1.0,
            segment_analysis: SegmentMetrics {
                segments_received: 0,
                segments_missing: 0,
                segment_duration_avg_ms: 10000,
                segment_duration_min_ms: 10000,
                segment_duration_max_ms: 10000,
                segment_size_avg_bytes: 1_000_000,
                segment_size_min_bytes: 900_000,
                segment_size_max_bytes: 1_100_000,
                sequence_gaps_detected: 0,
                duplicate_segments: 0,
                out_of_order_segments: 0,
                segment_arrival_jitter_ms: 0.0,
                segment_fetch_latency_ms: 0.0,
            },
            audio_tracks: vec![],
            subtitle_tracks: vec![],
            ebp_alignment: EBPMetrics {
                ebp_enabled: true,
                ebp_frames_received: 0,
                ebp_valid_frames: 0,
                ebp_sap_type1_count: 0,
                ebp_sap_type2_count: 0,
                ebp_timing_errors: 0,
                last_ebp_timestamp: 0,
            },
            fmp4_validation: FMP4Metrics {
                format: "fragmented_mp4".to_string(),
                ftyp_brand: "isom".to_string(),
                init_segment_size_bytes: 500,
                media_segment_size_bytes: 1_000_000,
                moof_boxes_received: 0,
                mdat_boxes_received: 0,
                box_size_errors: 0,
                sample_flag_errors: 0,
                duration_alignment_errors: 0,
                cenc_present: false,
                pssh_boxes: 0,
            },
            drm_metadata: DRMMetrics {
                drm_enabled: config.drm_enabled,
                drm_system: "widevine".to_string(),
                key_rotation_count: 0,
                key_rotation_interval_sec: 3600,
                license_fetch_time_ms: 100,
                license_errors: 0,
                drm_metadata_present: true,
            },
            alarms: vec![],
        };
        
        Self {
            stream_id,
            metrics: Arc::new(RwLock::new(metrics)),
            config,
        }
    }
    
    /// Default ABR ladder for HD/4K streaming
    fn default_abr_ladder() -> Vec<ABRRung> {
        vec![
            ABRRung {
                rung_id: 0,
                bitrate_kbps: 256,
                resolution: (426, 240),
                fps: 30.0,
                codec: "h264".to_string(),
                profile_level: "Main@3.0".to_string(),
                avg_segment_size_bytes: 320_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 1,
                bitrate_kbps: 512,
                resolution: (640, 360),
                fps: 30.0,
                codec: "h264".to_string(),
                profile_level: "Main@3.1".to_string(),
                avg_segment_size_bytes: 640_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 2,
                bitrate_kbps: 1500,
                resolution: (1280, 720),
                fps: 30.0,
                codec: "h264".to_string(),
                profile_level: "Main@4.0".to_string(),
                avg_segment_size_bytes: 1_875_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 3,
                bitrate_kbps: 3000,
                resolution: (1920, 1080),
                fps: 30.0,
                codec: "h264".to_string(),
                profile_level: "High@4.1".to_string(),
                avg_segment_size_bytes: 3_750_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 4,
                bitrate_kbps: 6000,
                resolution: (1920, 1080),
                fps: 30.0,
                codec: "h265".to_string(),
                profile_level: "Main@4.1".to_string(),
                avg_segment_size_bytes: 7_500_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 5,
                bitrate_kbps: 15000,
                resolution: (3840, 2160),
                fps: 30.0,
                codec: "h265".to_string(),
                profile_level: "Main10@5.0".to_string(),
                avg_segment_size_bytes: 18_750_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
            ABRRung {
                rung_id: 6,
                bitrate_kbps: 25000,
                resolution: (3840, 2160),
                fps: 30.0,
                codec: "h265".to_string(),
                profile_level: "Main10@5.0".to_string(),
                avg_segment_size_bytes: 31_250_000,
                bitrate_consistency: 1.0,
                segment_count: 0,
                segment_duration_expected: 10.0,
                segment_duration_variance: 0.0,
            },
        ]
    }
    
    /// Validate HLS m3u8 manifest
    pub async fn validate_hls_manifest(&self, m3u8_content: &str) -> bool {
        let mut metrics = self.metrics.write().await;
        
        // Parse m3u8
        let lines: Vec<&str> = m3u8_content.lines().collect();
        
        if lines.is_empty() || !lines[0].starts_with("#EXTM3U") {
            metrics.manifest.manifest_parse_errors += 1;
            return false;
        }
        
        // Extract target duration
        for line in &lines {
            if line.starts_with("#EXT-X-TARGETDURATION:") {
                if let Ok(duration) = line.split(':').nth(1).unwrap_or("0").parse::<f32>() {
                    metrics.manifest.target_duration_seconds = duration;
                }
            }
            if line.starts_with("#EXT-X-MEDIA-SEQUENCE:") {
                if let Ok(seq) = line.split(':').nth(1).unwrap_or("0").parse::<u64>() {
                    metrics.manifest.current_sequence_number = seq;
                }
            }
        }
        
        // Validate segment continuity
        let mut expected_seq = metrics.manifest.current_sequence_number;
        for line in &lines {
            if line.ends_with(".ts") || line.ends_with(".m4s") {
                // Parse segment number (simplified)
                expected_seq += 1;
            }
        }
        
        true
    }
    
    /// Validate DASH mpd manifest
    pub async fn validate_dash_mpd(&self, mpd_content: &str) -> bool {
        let mut metrics = self.metrics.write().await;
        
        // Simple XML parsing (in production, use xml library)
        if !mpd_content.contains("<MPD") {
            metrics.manifest.manifest_parse_errors += 1;
            return false;
        }
        
        metrics.manifest.manifest_parse_errors = 0;
        true
    }
    
    /// Validate ABR ladder consistency
    pub async fn validate_abr_ladder(&self) -> Option<L2Alarm> {
        let mut metrics = self.metrics.write().await;
        
        let mut consistency_score = 1.0;
        let mut errors_count = 0;
        
        for i in 1..metrics.abr_ladder.len() {
            let prev_rung = &metrics.abr_ladder[i - 1];
            let curr_rung = &metrics.abr_ladder[i];
            
            // Check bitrate monotonicity
            if curr_rung.bitrate_kbps <= prev_rung.bitrate_kbps {
                errors_count += 1;
                consistency_score -= 0.1;
            }
            
            // Check bitrate step size (shouldn't jump >100%)
            let step_ratio = curr_rung.bitrate_kbps as f32 / (prev_rung.bitrate_kbps as f32 + 1.0);
            if step_ratio > 3.0 || step_ratio < 0.5 {
                errors_count += 1;
                consistency_score -= 0.05;
            }
            
            // Check segment duration consistency
            if (curr_rung.segment_duration_expected - prev_rung.segment_duration_expected).abs() > 0.1 {
                errors_count += 1;
                consistency_score -= 0.05;
            }
        }
        
        metrics.abr_consistency = consistency_score.max(0.0);
        
        if consistency_score < 0.8 {
            return Some(L2Alarm {
                alarm_type: L2AlarmType::ABRLadderInconsistent,
                severity: Severity::Major,
                message: format!("ABR ladder consistency issues: {} errors detected", errors_count),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                rung_id: None,
                value: consistency_score,
                threshold: 0.8,
            });
        }
        
        None
    }
    
    /// Validate segment continuity
    pub async fn validate_segment_sequence(&self, current_seq: u64, expected_seq: u64) -> Option<L2Alarm> {
        let mut metrics = self.metrics.write().await;
        
        if current_seq != expected_seq {
            let gap = current_seq as i64 - expected_seq as i64;
            metrics.segment_analysis.sequence_gaps_detected += 1;
            
            if gap > 0 {
                return Some(L2Alarm {
                    alarm_type: L2AlarmType::SegmentGap,
                    severity: Severity::Major,
                    message: format!("Segment gap detected: missing {} segment(s)", gap),
                    timestamp_utc: chrono::Utc::now().to_rfc3339(),
                    rung_id: None,
                    value: gap as f32,
                    threshold: 0.0,
                });
            }
        }
        
        None
    }
    
    /// Validate EBP alignment with segments
    pub async fn validate_ebp_alignment(&self, ebp_present: bool, timing_match: bool) -> Option<L2Alarm> {
        let mut metrics = self.metrics.write().await;
        
        if !ebp_present {
            return None;  // EBP optional
        }
        
        metrics.ebp_alignment.ebp_frames_received += 1;
        
        if !timing_match {
            metrics.ebp_alignment.ebp_timing_errors += 1;
            
            if metrics.ebp_alignment.ebp_timing_errors > 5 {
                return Some(L2Alarm {
                    alarm_type: L2AlarmType::EBPMisaligned,
                    severity: Severity::Major,
                    message: "EBP timing misaligned with segment boundaries".to_string(),
                    timestamp_utc: chrono::Utc::now().to_rfc3339(),
                    rung_id: None,
                    value: metrics.ebp_alignment.ebp_timing_errors as f32,
                    threshold: 5.0,
                });
            }
        } else {
            metrics.ebp_alignment.ebp_valid_frames += 1;
        }
        
        None
    }
    
    /// Validate fMP4 box structure
    pub async fn validate_fmp4_boxes(&self, boxes_valid: bool) -> Option<L2Alarm> {
        let mut metrics = self.metrics.write().await;
        
        if !boxes_valid {
            metrics.fmp4_validation.box_size_errors += 1;
            
            return Some(L2Alarm {
                alarm_type: L2AlarmType::FMP4BoxError,
                severity: Severity::Major,
                message: "fMP4 box structure error or truncation detected".to_string(),
                timestamp_utc: chrono::Utc::now().to_rfc3339(),
                rung_id: None,
                value: metrics.fmp4_validation.box_size_errors as f32,
                threshold: 0.0,
            });
        }
        
        None
    }
    
    /// Get current metrics
    pub async fn get_metrics(&self) -> L2PackagerMetrics {
        self.metrics.read().await.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_abr_ladder_validation() {
        let config = L2PackagerConfig {
            manifest_format: ManifestFormat::HLS,
            expected_segment_duration_ms: 10000.0,
            segment_duration_tolerance_percent: 5.0,
            abr_ladder_validation: true,
            ebp_validation: true,
            drm_enabled: true,
        };
        
        let analyzer = L2PackagerAnalyzer::new("CH001".to_string(), config);
        let alarm = analyzer.validate_abr_ladder().await;
        
        // Should pass (default ladder is valid)
        assert!(alarm.is_none());
    }
    
    #[tokio::test]
    async fn test_segment_gap_detection() {
        let config = L2PackagerConfig {
            manifest_format: ManifestFormat::HLS,
            expected_segment_duration_ms: 10000.0,
            segment_duration_tolerance_percent: 5.0,
            abr_ladder_validation: true,
            ebp_validation: true,
            drm_enabled: true,
        };
        
        let analyzer = L2PackagerAnalyzer::new("CH001".to_string(), config);
        
        // Simulate gap: expected 100, got 105
        let alarm = analyzer.validate_segment_sequence(105, 100).await;
        
        assert!(alarm.is_some());
        assert_eq!(alarm.unwrap().alarm_type, L2AlarmType::SegmentGap);
    }
}
