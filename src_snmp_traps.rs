// src/output/snmp_traps.rs
// SNMP Trap Integration for NMS (Zabbix, Solarwinds, etc)

use std::net::UdpSocket;
use serde::{Deserialize, Serialize};
use chrono::Utc;

/// SNMP Trap configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SNMPTrapConfig {
    pub nms_host: String,               // NMS server IP
    pub nms_port: u16,                  // SNMP port (161)
    pub community_string: String,       // SNMP community (e.g., "public")
    pub enterprise_oid: String,         // Telestream OID: 1.3.6.1.4.1.37211.100
    pub enabled: bool,
}

/// SNMP Trap severity levels (mapped to NMS)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SNMPSeverity {
    Info = 0,           // Informational
    Warning = 1,        // Warning
    Minor = 2,          // Minor
    Major = 3,          // Major
    Critical = 4,       // Critical
}

/// SNMP Trap OID assignments
pub struct SNMPOIDs {
    // Enterprise base
    pub enterprise_base: &'static str,  // 1.3.6.1.4.1.37211.100
    
    // Video Quality Traps
    pub video_mos_low: &'static str,           // 1.3.6.1.4.1.37211.100.1
    pub macroblocking_high: &'static str,      // 1.3.6.1.4.1.37211.100.2
    pub freeze_frame_detected: &'static str,   // 1.3.6.1.4.1.37211.100.3
    pub black_frame_detected: &'static str,    // 1.3.6.1.4.1.37211.100.4
    
    // Audio Quality Traps
    pub audio_loudness_error: &'static str,    // 1.3.6.1.4.1.37211.100.5
    pub audio_silence: &'static str,           // 1.3.6.1.4.1.37211.100.6
    pub channel_missing: &'static str,         // 1.3.6.1.4.1.37211.100.7
    
    // TS/MPEG Traps
    pub ts_sync_loss: &'static str,            // 1.3.6.1.4.1.37211.100.8
    pub pcr_drift: &'static str,               // 1.3.6.1.4.1.37211.100.9
    pub pat_error: &'static str,               // 1.3.6.1.4.1.37211.100.10
    pub pmt_error: &'static str,               // 1.3.6.1.4.1.37211.100.11
    pub dts_error: &'static str,               // 1.3.6.1.4.1.37211.100.12
    
    // HDR/Dolby Traps
    pub hdr_metadata_missing: &'static str,    // 1.3.6.1.4.1.37211.100.13
    pub atmos_joc_error: &'static str,         // 1.3.6.1.4.1.37211.100.14
    
    // Network Traps
    pub mdi_high: &'static str,                // 1.3.6.1.4.1.37211.100.15
    pub packet_loss_high: &'static str,        // 1.3.6.1.4.1.37211.100.16
    pub latency_high: &'static str,            // 1.3.6.1.4.1.37211.100.17
    
    // Signaling Traps
    pub scte35_missing: &'static str,          // 1.3.6.1.4.1.37211.100.18
    pub caption_error: &'static str,           // 1.3.6.1.4.1.37211.100.19
    
    // Manifest/DRM Traps
    pub manifest_error: &'static str,          // 1.3.6.1.4.1.37211.100.20
    pub drm_error: &'static str,               // 1.3.6.1.4.1.37211.100.21
}

impl SNMPOIDs {
    pub fn new() -> Self {
        SNMPOIDs {
            enterprise_base: "1.3.6.1.4.1.37211.100",
            video_mos_low: "1.3.6.1.4.1.37211.100.1",
            macroblocking_high: "1.3.6.1.4.1.37211.100.2",
            freeze_frame_detected: "1.3.6.1.4.1.37211.100.3",
            black_frame_detected: "1.3.6.1.4.1.37211.100.4",
            audio_loudness_error: "1.3.6.1.4.1.37211.100.5",
            audio_silence: "1.3.6.1.4.1.37211.100.6",
            channel_missing: "1.3.6.1.4.1.37211.100.7",
            ts_sync_loss: "1.3.6.1.4.1.37211.100.8",
            pcr_drift: "1.3.6.1.4.1.37211.100.9",
            pat_error: "1.3.6.1.4.1.37211.100.10",
            pmt_error: "1.3.6.1.4.1.37211.100.11",
            dts_error: "1.3.6.1.4.1.37211.100.12",
            hdr_metadata_missing: "1.3.6.1.4.1.37211.100.13",
            atmos_joc_error: "1.3.6.1.4.1.37211.100.14",
            mdi_high: "1.3.6.1.4.1.37211.100.15",
            packet_loss_high: "1.3.6.1.4.1.37211.100.16",
            latency_high: "1.3.6.1.4.1.37211.100.17",
            scte35_missing: "1.3.6.1.4.1.37211.100.18",
            caption_error: "1.3.6.1.4.1.37211.100.19",
            manifest_error: "1.3.6.1.4.1.37211.100.20",
            drm_error: "1.3.6.1.4.1.37211.100.21",
        }
    }
}

/// SNMP Trap data structure (SNMPv2c format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SNMPTrap {
    pub enterprise_oid: String,
    pub specific_trap_number: u32,
    pub trigger_event: String,          // e.g., "TR_101_290_P1_ERROR"
    pub severity: SNMPSeverity,
    pub stream_id: String,
    pub message: String,
    pub value: f32,
    pub threshold: f32,
    pub timestamp: u64,                 // Unix epoch (ms)
    pub probe_id: String,
    pub layer: String,                  // "L1", "L2", "L3", "L4"
}

impl SNMPTrap {
    /// Convert to SNMP packet bytes (simplified SNMPv2c format)
    pub fn to_bytes(&self, community: &str) -> Vec<u8> {
        let mut payload = Vec::new();
        
        // SNMPv2c PDU (simplified - in production use snmp library)
        // This is pseudocode representation
        
        let pdu = format!(
            "SNMP Trap: enterprise={}, event={}, severity={:?}, stream={}, value={}",
            self.enterprise_oid, self.trigger_event, self.severity, self.stream_id, self.value
        );
        
        payload.extend_from_slice(pdu.as_bytes());
        payload
    }
}

/// SNMP Trap sender
pub struct SNMPTrapSender {
    config: SNMPTrapConfig,
    socket: UdpSocket,
}

impl SNMPTrapSender {
    pub fn new(config: SNMPTrapConfig) -> Result<Self, std::io::Error> {
        if !config.enabled {
            // Return dummy socket if disabled
            let socket = UdpSocket::bind("127.0.0.1:0")?;
            return Ok(SNMPTrapSender { config, socket });
        }
        
        let local_addr = "0.0.0.0:0";
        let socket = UdpSocket::bind(local_addr)?;
        socket.set_nonblocking(true)?;
        
        Ok(SNMPTrapSender { config, socket })
    }
    
    /// Send SNMP trap to NMS
    pub fn send_trap(&self, trap: &SNMPTrap) -> Result<(), std::io::Error> {
        if !self.config.enabled {
            return Ok(());
        }
        
        let nms_addr = format!("{}:{}", self.config.nms_host, self.config.nms_port);
        let trap_bytes = trap.to_bytes(&self.config.community_string);
        
        self.socket.send_to(&trap_bytes, &nms_addr)?;
        
        tracing::info!(
            "SNMP Trap sent to NMS: {} | Event: {} | Stream: {} | Severity: {:?}",
            nms_addr,
            trap.trigger_event,
            trap.stream_id,
            trap.severity
        );
        
        Ok(())
    }
}

/// Alarm to SNMP Trap converter
pub struct AlarmToSNMPConverter;

impl AlarmToSNMPConverter {
    /// Convert L1 Headend alarm to SNMP trap
    pub fn convert_l1_alarm(
        alarm: &crate::layers::l1_headend::L1Alarm,
        stream_id: &str,
        probe_id: &str,
    ) -> SNMPTrap {
        use crate::layers::l1_headend::AlarmType;
        
        let (specific_trap, severity, event_id) = match alarm.alarm_type {
            // Video alarms
            AlarmType::MacroblockingHigh => (2, SNMPSeverity::Major, "MACROBLOCKING_HIGH"),
            AlarmType::MoSLow => (1, SNMPSeverity::Critical, "VIDEO_MOS_LOW"),
            AlarmType::FreezeFrame => (3, SNMPSeverity::Critical, "FREEZE_FRAME_DETECTED"),
            AlarmType::BlackFrame => (4, SNMPSeverity::Critical, "BLACK_FRAME_DETECTED"),
            
            // Audio alarms
            AlarmType::AudioSilence => (6, SNMPSeverity::Critical, "AUDIO_SILENCE"),
            AlarmType::LoudnessOutOfRange => (5, SNMPSeverity::Major, "LOUDNESS_OUT_OF_RANGE"),
            AlarmType::ChannelMissing => (7, SNMPSeverity::Critical, "CHANNEL_MISSING"),
            
            // TS alarms
            AlarmType::TS_SyncLoss => (8, SNMPSeverity::Critical, "TS_SYNC_LOSS"),
            AlarmType::PCRDrift => (9, SNMPSeverity::Major, "PCR_DRIFT"),
            AlarmType::PATError => (10, SNMPSeverity::Critical, "PAT_ERROR"),
            AlarmType::PMTError => (11, SNMPSeverity::Critical, "PMT_ERROR"),
            AlarmType::DTSError => (12, SNMPSeverity::Major, "DTS_ERROR"),
            
            // HDR/Dolby alarms
            AlarmType::HDRMetadataMissing => (13, SNMPSeverity::Major, "HDR_METADATA_MISSING"),
            AlarmType::AtmosJocError => (14, SNMPSeverity::Major, "ATMOS_JOC_ERROR"),
            
            // Signaling alarms
            AlarmType::SCTE35Missing => (18, SNMPSeverity::Major, "SCTE35_MISSING"),
            AlarmType::CaptionError => (19, SNMPSeverity::Minor, "CAPTION_ERROR"),
            
            _ => (99, SNMPSeverity::Minor, "UNKNOWN"),
        };
        
        SNMPTrap {
            enterprise_oid: "1.3.6.1.4.1.37211.100".to_string(),
            specific_trap_number: specific_trap,
            trigger_event: event_id.to_string(),
            severity,
            stream_id: stream_id.to_string(),
            message: alarm.message.clone(),
            value: alarm.value,
            threshold: alarm.threshold,
            timestamp: Utc::now().timestamp_millis() as u64,
            probe_id: probe_id.to_string(),
            layer: "L1".to_string(),
        }
    }
    
    /// Convert L2 Packager alarm to SNMP trap
    pub fn convert_l2_alarm(
        alarm: &crate::layers::l2_packager::L2Alarm,
        stream_id: &str,
        probe_id: &str,
    ) -> SNMPTrap {
        use crate::layers::l2_packager::L2AlarmType;
        
        let (specific_trap, severity, event_id) = match alarm.alarm_type {
            L2AlarmType::ManifestParseError => (20, SNMPSeverity::Major, "MANIFEST_ERROR"),
            L2AlarmType::ABRLadderInconsistent => (20, SNMPSeverity::Major, "ABR_LADDER_ERROR"),
            L2AlarmType::SegmentMissing => (20, SNMPSeverity::Major, "SEGMENT_MISSING"),
            L2AlarmType::SegmentGap => (20, SNMPSeverity::Major, "SEGMENT_GAP"),
            L2AlarmType::EBPMisaligned => (20, SNMPSeverity::Minor, "EBP_MISALIGNED"),
            L2AlarmType::FMP4BoxError => (20, SNMPSeverity::Major, "FMPQ_BOX_ERROR"),
            L2AlarmType::DRMMetadataMissing => (21, SNMPSeverity::Critical, "DRM_METADATA_MISSING"),
            L2AlarmType::TrackSyncError => (20, SNMPSeverity::Major, "TRACK_SYNC_ERROR"),
        };
        
        SNMPTrap {
            enterprise_oid: "1.3.6.1.4.1.37211.100".to_string(),
            specific_trap_number: specific_trap,
            trigger_event: event_id.to_string(),
            severity,
            stream_id: stream_id.to_string(),
            message: alarm.message.clone(),
            value: alarm.value,
            threshold: alarm.threshold,
            timestamp: Utc::now().timestamp_millis() as u64,
            probe_id: probe_id.to_string(),
            layer: "L2".to_string(),
        }
    }
}

/// SNMP Configuration example
#[cfg(test)]
mod snmp_config_example {
    use super::*;
    
    #[test]
    fn example_snmp_config() {
        let config = SNMPTrapConfig {
            nms_host: "192.168.1.100".to_string(),  // NMS server
            nms_port: 162,                           // SNMP trap port
            community_string: "public".to_string(),
            enterprise_oid: "1.3.6.1.4.1.37211.100".to_string(),
            enabled: true,
        };
        
        // Config would be loaded from YAML:
        // snmp:
        //   enabled: true
        //   nms_host: "nms.company.com"
        //   nms_port: 162
        //   community: "trapwrite"
        //   enterprise_oid: "1.3.6.1.4.1.37211.100"
        
        println!("SNMP Config: {:?}", config);
    }
}

/// SNMP Trap Event Type Reference
///
/// Zabbix Integration:
/// In Zabbix, create SNMP OID mapping:
/// 
/// Numeric OID                           | Name
/// 1.3.6.1.4.1.37211.100.1              | Video MOS Low
/// 1.3.6.1.4.1.37211.100.2              | Macroblocking High
/// 1.3.6.1.4.1.37211.100.8              | TS Sync Loss
/// 1.3.6.1.4.1.37211.100.13             | HDR Metadata Missing
/// 
/// Solarwinds Integration:
/// Use SNMP Trap Configuration to:
/// - Map OIDs to Alert Rules
/// - Set escalation policies
/// - Configure notification channels (email, Slack, PagerDuty)
/// 
/// Example Solarwinds Rule:
/// IF SNMP Trap OID = 1.3.6.1.4.1.37211.100.8 (TS Sync Loss)
/// THEN severity = CRITICAL
/// THEN escalate to on-call engineer
/// THEN send to email + Slack
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_snmp_trap_creation() {
        let trap = SNMPTrap {
            enterprise_oid: "1.3.6.1.4.1.37211.100".to_string(),
            specific_trap_number: 8,
            trigger_event: "TS_SYNC_LOSS".to_string(),
            severity: SNMPSeverity::Critical,
            stream_id: "CH001".to_string(),
            message: "TS sync byte (0x47) lost".to_string(),
            value: 1.0,
            threshold: 0.0,
            timestamp: 1673625600000,
            probe_id: "HEADEND-01".to_string(),
            layer: "L1".to_string(),
        };
        
        let trap_bytes = trap.to_bytes("public");
        assert!(!trap_bytes.is_empty());
        println!("SNMP Trap bytes: {:?}", String::from_utf8_lossy(&trap_bytes));
    }
    
    #[test]
    fn test_snmp_severity_mapping() {
        let severities = vec![
            SNMPSeverity::Info,
            SNMPSeverity::Warning,
            SNMPSeverity::Minor,
            SNMPSeverity::Major,
            SNMPSeverity::Critical,
        ];
        
        for severity in severities {
            println!("Severity: {:?} = {}", severity, severity as u32);
        }
    }
}
