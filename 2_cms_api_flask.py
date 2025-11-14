#!/usr/bin/env python3
"""
FPT Play - CMS API (Channel Management System)
REST API for channel configuration, templates, alert management
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import logging
import os
import glob

# ============================================================================
# CONFIGURATION
# ============================================================================

app = Flask(__name__)
CORS(app)

# Database
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql://monitor_app:secure_password@db.monitor.local/fpt_play_monitoring'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

db = SQLAlchemy(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class Channel(db.Model):
    __tablename__ = 'channels'
    
    channel_id = db.Column(db.Integer, primary_key=True)
    channel_code = db.Column(db.String(50), unique=True, nullable=False)
    channel_name = db.Column(db.String(200), nullable=False)
    channel_type = db.Column(db.String(20), nullable=False)  # LIVE, VOD, EVENT
    tier = db.Column(db.Integer, nullable=False)  # 1, 2, 3
    codec = db.Column(db.String(20))  # H.264, HEVC
    resolution = db.Column(db.String(20))  # 1920x1080, 3840x2160
    fps = db.Column(db.Float)
    is_4k = db.Column(db.Boolean, default=False)
    is_hdr = db.Column(db.Boolean, default=False)
    has_atmos = db.Column(db.Boolean, default=False)
    probe_id = db.Column(db.Integer, db.ForeignKey('probes.probe_id'), nullable=False)
    input_url = db.Column(db.Text)
    template_id = db.Column(db.Integer, db.ForeignKey('templates.template_id'), nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    probe = db.relationship('Probe', backref='channels')
    template = db.relationship('Template', backref='channels')
    
    def to_dict(self):
        return {
            'channel_id': self.channel_id,
            'channel_code': self.channel_code,
            'channel_name': self.channel_name,
            'channel_type': self.channel_type,
            'tier': self.tier,
            'codec': self.codec,
            'resolution': self.resolution,
            'fps': self.fps,
            'is_4k': self.is_4k,
            'is_hdr': self.is_hdr,
            'has_atmos': self.has_atmos,
            'probe_id': self.probe_id,
            'input_url': self.input_url,
            'template_id': self.template_id,
            'enabled': self.enabled,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Probe(db.Model):
    __tablename__ = 'probes'
    
    probe_id = db.Column(db.Integer, primary_key=True)
    probe_name = db.Column(db.String(50), unique=True, nullable=False)
    layer = db.Column(db.Integer, nullable=False)  # 1-5
    location = db.Column(db.String(100))
    ip_address = db.Column(db.String(50), nullable=False)
    port = db.Column(db.Integer, default=8443)
    api_token = db.Column(db.String(255))
    snmp_enabled = db.Column(db.Boolean, default=True)
    snmp_version = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'probe_id': self.probe_id,
            'probe_name': self.probe_name,
            'layer': self.layer,
            'location': self.location,
            'ip_address': self.ip_address,
            'port': self.port,
            'snmp_enabled': self.snmp_enabled,
            'snmp_version': self.snmp_version,
            'created_at': self.created_at.isoformat()
        }


class Template(db.Model):
    __tablename__ = 'templates'
    
    template_id = db.Column(db.Integer, primary_key=True)
    template_name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    codec = db.Column(db.String(20))
    min_mos = db.Column(db.Float, default=2.0)
    max_mos = db.Column(db.Float, default=5.0)
    loudness_target = db.Column(db.Float, default=-23.0)
    loudness_tolerance = db.Column(db.Float, default=2.0)
    macroblocking_threshold = db.Column(db.Float, default=0.15)
    freeze_threshold_ms = db.Column(db.Integer, default=1000)
    black_threshold_ms = db.Column(db.Integer, default=500)
    pcr_jitter_threshold_ns = db.Column(db.Integer, default=500)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'template_id': self.template_id,
            'template_name': self.template_name,
            'description': self.description,
            'codec': self.codec,
            'min_mos': self.min_mos,
            'max_mos': self.max_mos,
            'loudness_target': self.loudness_target,
            'loudness_tolerance': self.loudness_tolerance,
            'macroblocking_threshold': self.macroblocking_threshold,
            'freeze_threshold_ms': self.freeze_threshold_ms,
            'black_threshold_ms': self.black_threshold_ms,
            'pcr_jitter_threshold_ns': self.pcr_jitter_threshold_ns,
            'created_at': self.created_at.isoformat()
        }


class Alert(db.Model):
    __tablename__ = 'alerts'

    alert_id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.channel_id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text)
    acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_by = db.Column(db.String(100))
    acknowledged_at = db.Column(db.DateTime)
    resolved = db.Column(db.Boolean, default=False)
    resolved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    channel = db.relationship('Channel', backref='alerts')

    def to_dict(self):
        return {
            'alert_id': self.alert_id,
            'channel_id': self.channel_id,
            'alert_type': self.alert_type,
            'severity': self.severity,
            'message': self.message,
            'acknowledged': self.acknowledged,
            'acknowledged_by': self.acknowledged_by,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'resolved': self.resolved,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at': self.created_at.isoformat()
        }


class Input(db.Model):
    __tablename__ = 'inputs'

    input_id = db.Column(db.Integer, primary_key=True)
    input_name = db.Column(db.String(200), nullable=False)
    input_url = db.Column(db.Text, nullable=False)
    input_type = db.Column(db.String(50), nullable=False)  # MPEGTS_UDP, HTTP, HLS, etc.
    input_protocol = db.Column(db.String(50))  # udp, http, rtmp, etc.
    input_port = db.Column(db.Integer)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.channel_id'))
    probe_id = db.Column(db.Integer, db.ForeignKey('probes.probe_id'), nullable=False)
    is_primary = db.Column(db.Boolean, default=True)
    enabled = db.Column(db.Boolean, default=True)
    bitrate_mbps = db.Column(db.Float)
    input_metadata = db.Column(db.JSON)
    snapshot_url = db.Column(db.Text)
    last_snapshot_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    channel = db.relationship('Channel', backref='inputs')
    probe = db.relationship('Probe', backref='inputs')

    def to_dict(self):
        return {
            'input_id': self.input_id,
            'input_name': self.input_name,
            'input_url': self.input_url,
            'input_type': self.input_type,
            'input_protocol': self.input_protocol,
            'input_port': self.input_port,
            'channel_id': self.channel_id,
            'probe_id': self.probe_id,
            'is_primary': self.is_primary,
            'enabled': self.enabled,
            'bitrate_mbps': self.bitrate_mbps,
            'input_metadata': self.input_metadata,
            'snapshot_url': self.snapshot_url,
            'last_snapshot_at': self.last_snapshot_at.isoformat() if self.last_snapshot_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# ============================================================================
# CHANNELS ENDPOINTS
# ============================================================================

@app.route('/api/v1/channels', methods=['GET'])
def get_channels():
    """Get all channels with filters"""
    tier = request.args.get('tier', type=int)
    is_4k = request.args.get('is_4k', type=lambda x: x.lower() == 'true')
    enabled = request.args.get('enabled', type=lambda x: x.lower() == 'true', default=True)
    
    query = Channel.query.filter_by(enabled=enabled)
    
    if tier:
        query = query.filter_by(tier=tier)
    
    if is_4k is not None:
        query = query.filter_by(is_4k=is_4k)
    
    channels = query.all()
    
    return jsonify({
        'status': 'ok',
        'count': len(channels),
        'channels': [ch.to_dict() for ch in channels]
    })


@app.route('/api/v1/channels/<int:channel_id>', methods=['GET'])
def get_channel(channel_id):
    """Get channel details"""
    channel = Channel.query.get(channel_id)
    
    if not channel:
        return jsonify({'status': 'error', 'message': 'Channel not found'}), 404
    
    return jsonify({
        'status': 'ok',
        'channel': channel.to_dict(),
        'probe': channel.probe.to_dict(),
        'template': channel.template.to_dict()
    })


@app.route('/api/v1/channels', methods=['POST'])
def create_channel():
    """Create new channel"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['channel_code', 'channel_name', 'channel_type', 'tier', 'probe_id', 'input_url', 'template_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'status': 'error', 'message': f'Missing field: {field}'}), 400
    
    # Check if channel already exists
    if Channel.query.filter_by(channel_code=data['channel_code']).first():
        return jsonify({'status': 'error', 'message': 'Channel code already exists'}), 409
    
    try:
        channel = Channel(
            channel_code=data['channel_code'],
            channel_name=data['channel_name'],
            channel_type=data['channel_type'],
            tier=data['tier'],
            codec=data.get('codec'),
            resolution=data.get('resolution'),
            fps=data.get('fps'),
            is_4k=data.get('is_4k', False),
            is_hdr=data.get('is_hdr', False),
            has_atmos=data.get('has_atmos', False),
            probe_id=data['probe_id'],
            input_url=data['input_url'],
            template_id=data['template_id'],
            enabled=data.get('enabled', True)
        )
        
        db.session.add(channel)
        db.session.commit()
        
        logger.info(f"Created channel: {channel.channel_code}")
        
        return jsonify({
            'status': 'ok',
            'channel_id': channel.channel_id,
            'message': 'Channel created successfully'
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating channel: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/channels/<int:channel_id>', methods=['PUT'])
def update_channel(channel_id):
    """Update channel"""
    channel = Channel.query.get(channel_id)
    
    if not channel:
        return jsonify({'status': 'error', 'message': 'Channel not found'}), 404
    
    data = request.get_json()
    
    try:
        for key in ['channel_name', 'tier', 'enabled', 'template_id', 'codec', 'resolution']:
            if key in data:
                setattr(channel, key, data[key])
        
        channel.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Updated channel: {channel.channel_code}")
        
        return jsonify({'status': 'ok', 'message': 'Channel updated successfully'})
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating channel: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/channels/<int:channel_id>', methods=['DELETE'])
def delete_channel(channel_id):
    """Delete channel (soft delete)"""
    channel = Channel.query.get(channel_id)
    
    if not channel:
        return jsonify({'status': 'error', 'message': 'Channel not found'}), 404
    
    try:
        channel.enabled = False
        db.session.commit()
        
        logger.info(f"Disabled channel: {channel.channel_code}")
        
        return jsonify({'status': 'ok', 'message': 'Channel disabled successfully'})
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error disabling channel: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ============================================================================
# TEMPLATES ENDPOINTS
# ============================================================================

@app.route('/api/v1/templates', methods=['GET'])
def get_templates():
    """Get all templates"""
    templates = Template.query.all()
    
    return jsonify({
        'status': 'ok',
        'count': len(templates),
        'templates': [t.to_dict() for t in templates]
    })


@app.route('/api/v1/templates', methods=['POST'])
def create_template():
    """Create new template"""
    data = request.get_json()
    
    try:
        template = Template(
            template_name=data['template_name'],
            description=data.get('description'),
            codec=data.get('codec'),
            min_mos=data.get('min_mos', 2.0),
            max_mos=data.get('max_mos', 5.0),
            loudness_target=data.get('loudness_target', -23.0),
            loudness_tolerance=data.get('loudness_tolerance', 2.0),
            macroblocking_threshold=data.get('macroblocking_threshold', 0.15),
            freeze_threshold_ms=data.get('freeze_threshold_ms', 1000),
            black_threshold_ms=data.get('black_threshold_ms', 500),
            pcr_jitter_threshold_ns=data.get('pcr_jitter_threshold_ns', 500)
        )
        
        db.session.add(template)
        db.session.commit()
        
        logger.info(f"Created template: {template.template_name}")
        
        return jsonify({
            'status': 'ok',
            'template_id': template.template_id,
            'message': 'Template created successfully'
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating template: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ============================================================================
# ALERTS ENDPOINTS
# ============================================================================

@app.route('/api/v1/alerts/active', methods=['GET'])
def get_active_alerts():
    """Get active (unresolved) alerts"""
    alerts = Alert.query.filter_by(resolved=False).order_by(
        Alert.severity.desc(),
        Alert.created_at.desc()
    ).all()
    
    return jsonify({
        'status': 'ok',
        'count': len(alerts),
        'alerts': [a.to_dict() for a in alerts]
    })


@app.route('/api/v1/alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """Acknowledge alert"""
    alert = Alert.query.get(alert_id)
    
    if not alert:
        return jsonify({'status': 'error', 'message': 'Alert not found'}), 404
    
    data = request.get_json() or {}
    
    try:
        alert.acknowledged = True
        alert.acknowledged_by = data.get('acknowledged_by', 'system')
        alert.acknowledged_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Acknowledged alert: {alert_id}")
        
        return jsonify({'status': 'ok', 'message': 'Alert acknowledged'})
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error acknowledging alert: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/alerts/<int:alert_id>/resolve', methods=['POST'])
def resolve_alert(alert_id):
    """Resolve alert"""
    alert = Alert.query.get(alert_id)
    
    if not alert:
        return jsonify({'status': 'error', 'message': 'Alert not found'}), 404
    
    try:
        alert.resolved = True
        alert.resolved_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Resolved alert: {alert_id}")
        
        return jsonify({'status': 'ok', 'message': 'Alert resolved'})
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resolving alert: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/alerts', methods=['POST'])
def create_alert():
    """Create new alert"""
    data = request.get_json()
    
    try:
        alert = Alert(
            channel_id=data['channel_id'],
            alert_type=data['alert_type'],
            severity=data['severity'],
            message=data.get('message')
        )
        
        db.session.add(alert)
        db.session.commit()
        
        logger.info(f"Created alert: {alert.alert_id} - {alert.alert_type}")
        
        return jsonify({
            'status': 'ok',
            'alert_id': alert.alert_id,
            'message': 'Alert created'
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating alert: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ============================================================================
# PROBES ENDPOINTS
# ============================================================================

@app.route('/api/v1/probes', methods=['GET'])
def get_probes():
    """Get all probes"""
    probes = Probe.query.all()
    
    return jsonify({
        'status': 'ok',
        'count': len(probes),
        'probes': [p.to_dict() for p in probes]
    })


@app.route('/api/v1/probes', methods=['POST'])
def create_probe():
    """Create new probe"""
    data = request.get_json()

    try:
        probe = Probe(
            probe_name=data['probe_name'],
            layer=data['layer'],
            location=data.get('location'),
            ip_address=data['ip_address'],
            port=data.get('port', 8443),
            api_token=data.get('api_token'),
            snmp_enabled=data.get('snmp_enabled', True),
            snmp_version=data.get('snmp_version', 'v2c')
        )

        db.session.add(probe)
        db.session.commit()

        logger.info(f"Created probe: {probe.probe_name}")

        return jsonify({
            'status': 'ok',
            'probe_id': probe.probe_id,
            'message': 'Probe created'
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating probe: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ============================================================================
# INPUTS ENDPOINTS
# ============================================================================

@app.route('/api/v1/inputs', methods=['GET'])
def get_inputs():
    """Get all inputs with optional filters and channel names"""
    probe_id = request.args.get('probe_id', type=int)
    channel_id = request.args.get('channel_id', type=int)
    enabled = request.args.get('enabled', type=lambda x: x.lower() == 'true', default=None)

    query = Input.query

    if probe_id:
        query = query.filter_by(probe_id=probe_id)

    if channel_id:
        query = query.filter_by(channel_id=channel_id)

    if enabled is not None:
        query = query.filter_by(enabled=enabled)

    inputs = query.all()

    # Enrich with channel names
    result = []
    for inp in inputs:
        input_dict = inp.to_dict()
        if inp.channel:
            input_dict['channel_name'] = inp.channel.channel_name
        else:
            input_dict['channel_name'] = None
        result.append(input_dict)

    return jsonify({
        'status': 'ok',
        'count': len(result),
        'inputs': result
    })


@app.route('/api/v1/inputs/<int:input_id>', methods=['GET'])
def get_input(input_id):
    """Get input details with channel and probe info"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    input_dict = inp.to_dict()
    if inp.channel:
        input_dict['channel_name'] = inp.channel.channel_name
        input_dict['channel_info'] = inp.channel.to_dict()
    if inp.probe:
        input_dict['probe_info'] = inp.probe.to_dict()

    return jsonify({
        'status': 'ok',
        'input': input_dict
    })


@app.route('/api/v1/inputs', methods=['POST'])
def create_input():
    """Create new input"""
    data = request.get_json()

    # Validate required fields
    required_fields = ['input_name', 'input_url', 'input_type', 'probe_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'status': 'error', 'message': f'Missing field: {field}'}), 400

    try:
        inp = Input(
            input_name=data['input_name'],
            input_url=data['input_url'],
            input_type=data['input_type'],
            input_protocol=data.get('input_protocol'),
            input_port=data.get('input_port'),
            channel_id=data.get('channel_id'),
            probe_id=data['probe_id'],
            is_primary=data.get('is_primary', True),
            enabled=data.get('enabled', True),
            bitrate_mbps=data.get('bitrate_mbps'),
            input_metadata=data.get('input_metadata')
        )

        db.session.add(inp)
        db.session.commit()

        logger.info(f"Created input: {inp.input_name}")

        return jsonify({
            'status': 'ok',
            'input_id': inp.input_id,
            'message': 'Input created successfully'
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating input: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/inputs/<int:input_id>', methods=['PUT'])
def update_input(input_id):
    """Update input"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    data = request.get_json()

    try:
        for key in ['input_name', 'input_url', 'input_type', 'input_protocol', 'input_port',
                    'channel_id', 'probe_id', 'is_primary', 'enabled', 'bitrate_mbps', 'input_metadata']:
            if key in data:
                setattr(inp, key, data[key])

        inp.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated input: {inp.input_name}")

        return jsonify({'status': 'ok', 'message': 'Input updated successfully'})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating input: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/inputs/<int:input_id>', methods=['DELETE'])
def delete_input(input_id):
    """Delete input (soft delete by disabling)"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    try:
        inp.enabled = False
        db.session.commit()

        logger.info(f"Disabled input: {inp.input_name}")

        return jsonify({'status': 'ok', 'message': 'Input disabled successfully'})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error disabling input: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/inputs/<int:input_id>/snapshot', methods=['GET'])
def get_input_snapshot(input_id):
    """Get latest snapshot image for input"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    if not inp.snapshot_url or not os.path.exists(inp.snapshot_url):
        return jsonify({'status': 'error', 'message': 'No snapshot available'}), 404

    try:
        return send_file(inp.snapshot_url, mimetype='image/jpeg')
    except Exception as e:
        logger.error(f"Error serving snapshot: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/inputs/<int:input_id>/metrics', methods=['GET'])
def get_input_metrics(input_id):
    """Get recent metrics for input from database"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    # This would query InfluxDB for recent metrics
    # For now, return basic info from the database
    metrics = {
        'input_id': inp.input_id,
        'input_name': inp.input_name,
        'input_type': inp.input_type,
        'enabled': inp.enabled,
        'has_snapshot': inp.snapshot_url is not None,
        'last_snapshot_at': inp.last_snapshot_at.isoformat() if inp.last_snapshot_at else None,
        'bitrate_mbps': inp.bitrate_mbps,
        'updated_at': inp.updated_at.isoformat()
    }

    return jsonify({
        'status': 'ok',
        'metrics': metrics
    })


@app.route('/api/v1/debug/inputs', methods=['GET'])
def debug_inputs():
    """Debug endpoint to show all input details including snapshots"""
    inputs = Input.query.all()

    debug_info = []
    for inp in inputs:
        info = inp.to_dict()
        if inp.channel:
            info['channel_name'] = inp.channel.channel_name
        info['snapshot_exists'] = os.path.exists(inp.snapshot_url) if inp.snapshot_url else False
        debug_info.append(info)

    return jsonify({
        'status': 'ok',
        'count': len(debug_info),
        'inputs': debug_info,
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/api/v1/debug/system', methods=['GET'])
def debug_system():
    """Debug endpoint for system information"""
    try:
        # Test database connection
        db.session.execute('SELECT 1')

        # Count records
        channel_count = Channel.query.count()
        input_count = Input.query.count()
        probe_count = Probe.query.count()
        alert_count = Alert.query.filter_by(resolved=False).count()

        return jsonify({
            'status': 'ok',
            'database': 'connected',
            'counts': {
                'channels': channel_count,
                'inputs': input_count,
                'probes': probe_count,
                'active_alerts': alert_count
            },
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        logger.error(f"Debug system check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'connected'
        })
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'status': 'error', 'message': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {error}")
    return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

# ============================================================================
# INITIALIZATION
# ============================================================================

def init_db():
    """Initialize database"""
    with app.app_context():
        db.create_all()
        logger.info("Database initialized")

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
