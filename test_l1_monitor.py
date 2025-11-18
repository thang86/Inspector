#!/usr/bin/env python3
"""
Test script for L1 Headend Monitor
Tests TR 101 290, HDR, Atmos, and Loudness analysis
"""

import sys
import json
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import L1 monitor
try:
    from l1_headend_monitor import L1HeadendMonitor
except ImportError:
    logger.error("Cannot import l1_headend_monitor. Make sure it's in the same directory.")
    sys.exit(1)


def print_section(title):
    """Print section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_results(results, section):
    """Print results in readable format"""
    if not results:
        print(f"❌ No {section} results")
        return

    print(f"\n📊 {section.upper()} Results:")
    print("-" * 70)
    print(json.dumps(results, indent=2, default=str))


def test_stream_info(monitor, input_url):
    """Test basic stream information retrieval"""
    print_section("TEST 1: Stream Information")

    print(f"🔍 Analyzing stream: {input_url}")

    try:
        stream_info = monitor._analyze_stream_info(input_url)

        if not stream_info:
            print("❌ Failed to get stream info")
            return False

        print("\n✅ Stream info retrieved successfully")

        # Print basic info
        if 'format' in stream_info:
            fmt = stream_info['format']
            print(f"\n📺 Format:")
            print(f"  Format: {fmt.get('format_name', 'Unknown')}")
            print(f"  Duration: {fmt.get('duration', 'Unknown')}s")
            print(f"  Bitrate: {int(fmt.get('bit_rate', 0)) / 1000:.0f} kbps")

        # Print streams
        if 'streams' in stream_info:
            print(f"\n📡 Streams ({len(stream_info['streams'])}):")
            for i, stream in enumerate(stream_info['streams']):
                codec_type = stream.get('codec_type', 'unknown')
                codec_name = stream.get('codec_name', 'unknown')
                print(f"  Stream {i}: {codec_type.upper()} - {codec_name}")

                if codec_type == 'video':
                    print(f"    Resolution: {stream.get('width', '?')}x{stream.get('height', '?')}")
                    print(f"    FPS: {stream.get('r_frame_rate', '?')}")
                elif codec_type == 'audio':
                    print(f"    Channels: {stream.get('channels', '?')}")
                    print(f"    Sample Rate: {stream.get('sample_rate', '?')} Hz")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_tr101290(monitor, input_url, duration=10):
    """Test TR 101 290 analysis"""
    print_section("TEST 2: TR 101 290 (MPEG-TS Compliance)")

    print(f"🔍 Analyzing {duration} seconds of stream...")
    print("⏳ This may take a while...")

    try:
        results = monitor._analyze_tr101290(input_url, duration)

        print(f"\n{'✅' if results.is_valid else '❌'} Analysis complete")
        print(f"Valid: {results.is_valid}")

        # Print Priority 1 errors
        print("\n🔴 Priority 1 Errors (CRITICAL):")
        print(f"  Sync Byte Errors: {results.sync_byte_error}")
        print(f"  PAT Errors: {results.pat_error}")
        print(f"  PMT Errors: {results.pmt_error}")
        print(f"  Continuity Errors: {results.continuity_count_error}")
        print(f"  PID Errors: {results.pid_error}")

        # Print Priority 2 errors
        print("\n🟡 Priority 2 Errors (SHOULD FIX):")
        print(f"  Transport Errors: {results.transport_error}")
        print(f"  CRC Errors: {results.crc_error}")
        print(f"  PCR Errors: {results.pcr_error}")
        print(f"  PCR Discontinuity: {results.pcr_discontinuity}")

        # Print errors list
        if results.errors:
            print(f"\n⚠️  Error Messages ({len(results.errors)}):")
            for error in results.errors:
                print(f"  - {error}")
        else:
            print("\n✅ No errors detected")

        return results.is_valid

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_hdr(monitor, input_url, duration=10):
    """Test HDR metadata analysis"""
    print_section("TEST 3: HDR Metadata Validation")

    print(f"🔍 Checking HDR metadata...")

    try:
        results = monitor._analyze_hdr(input_url, duration)

        print(f"\n{'✅' if results.has_hdr else '—'} HDR Status")
        print(f"Has HDR: {results.has_hdr}")

        if results.has_hdr:
            print(f"\n📺 HDR Details:")
            print(f"  Transfer: {results.transfer_characteristics or 'Unknown'}")
            print(f"  Color Primaries: {results.color_primaries or 'Unknown'}")
            print(f"  Matrix: {results.matrix_coefficients or 'Unknown'}")

            if results.mastering_display_metadata:
                print(f"  Mastering Display: Present ✅")
            else:
                print(f"  Mastering Display: Missing ❌")

            if results.content_light_level:
                print(f"  Content Light Level: Present ✅")
            else:
                print(f"  Content Light Level: Missing ❌")

            print(f"\n  Valid: {'✅' if results.is_valid else '❌'}")
        else:
            print("\nℹ️  No HDR detected (stream may be SDR)")

        if results.errors:
            print(f"\n⚠️  HDR Issues:")
            for error in results.errors:
                print(f"  - {error}")

        return results.has_hdr

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_atmos(monitor, input_url):
    """Test Dolby Atmos detection"""
    print_section("TEST 4: Dolby Atmos Detection")

    print(f"🔍 Checking for Dolby Atmos...")

    try:
        # Get stream info first
        stream_info = monitor._analyze_stream_info(input_url)
        results = monitor._analyze_atmos(input_url, stream_info)

        print(f"\n{'✅' if results.has_atmos else '—'} Atmos Status")
        print(f"Has Atmos: {results.has_atmos}")

        if results.has_atmos:
            print(f"\n🔊 Atmos Details:")
            print(f"  Codec: {results.codec or 'Unknown'}")
            print(f"  Channel Layout: {results.channel_layout or 'Unknown'}")
            print(f"  Bed Channels: {results.bed_channels}")
            print(f"  Sample Rate: {results.sample_rate} Hz")
            print(f"  Bitrate: {results.bitrate / 1000:.0f} kbps")
            print(f"\n  Valid: {'✅' if results.is_valid else '❌'}")
        else:
            print("\nℹ️  No Dolby Atmos detected")
            print("    Stream may have standard audio (stereo, 5.1, etc.)")

        if results.errors:
            print(f"\n⚠️  Atmos Issues:")
            for error in results.errors:
                print(f"  - {error}")

        return results.has_atmos

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_loudness(monitor, input_url, duration=10):
    """Test audio loudness analysis"""
    print_section("TEST 5: Audio Loudness (EBU R128)")

    print(f"🔍 Measuring loudness over {duration} seconds...")
    print("⏳ This will take some time (decoding audio)...")

    try:
        results = monitor._analyze_loudness(input_url, duration)

        print(f"\n{'✅' if results.is_compliant else '❌'} Loudness Analysis")

        if results.integrated_loudness is not None:
            print(f"\n📊 Loudness Measurements:")
            print(f"  Integrated Loudness: {results.integrated_loudness:.1f} LUFS")
            print(f"  Loudness Range: {results.loudness_range:.1f} LU")
            print(f"  True Peak: {results.true_peak:.1f} dBTP")

            print(f"\n📏 Compliance Check:")
            print(f"  Target: {results.target_loudness} LUFS ± {results.tolerance} LU")

            # Check compliance
            diff = abs(results.integrated_loudness - results.target_loudness)
            if diff <= results.tolerance:
                print(f"  Status: ✅ COMPLIANT (within range)")
            else:
                print(f"  Status: ❌ NON-COMPLIANT (off by {diff:.1f} LUFS)")

            # Check true peak
            if results.true_peak < -1.0:
                print(f"  True Peak: ✅ OK (< -1.0 dBTP)")
            else:
                print(f"  True Peak: ❌ TOO HIGH (risk of clipping)")
        else:
            print("❌ Could not measure loudness")

        if results.errors:
            print(f"\n⚠️  Loudness Issues:")
            for error in results.errors:
                print(f"  - {error}")

        return results.is_compliant

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_full_analysis(monitor, input_url, duration=10):
    """Test complete L1 analysis"""
    print_section("TEST 6: Complete L1 Analysis")

    print(f"🔍 Running full L1 analysis...")
    print(f"⏳ Duration: {duration} seconds")
    print("⏳ This will take several minutes...")

    try:
        results = monitor.analyze_input(input_url, duration)

        print("\n" + "=" * 70)
        print("📋 COMPLETE RESULTS")
        print("=" * 70)

        # Summary
        print("\n📊 Summary:")
        print(f"  Input URL: {results['input_url']}")
        print(f"  Timestamp: {results['timestamp']}")

        # TR 101 290
        if results.get('tr101290'):
            tr = results['tr101290']
            status = "✅ PASS" if tr.get('is_valid') else "❌ FAIL"
            print(f"\n  TR 101 290: {status}")
            if tr.get('errors'):
                print(f"    Errors: {len(tr['errors'])}")

        # HDR
        if results.get('hdr'):
            hdr = results['hdr']
            status = "✅ DETECTED" if hdr.get('has_hdr') else "— NOT DETECTED"
            print(f"  HDR: {status}")
            if hdr.get('has_hdr'):
                print(f"    Transfer: {hdr.get('transfer_characteristics', 'Unknown')}")

        # Atmos
        if results.get('atmos'):
            atmos = results['atmos']
            status = "✅ DETECTED" if atmos.get('has_atmos') else "— NOT DETECTED"
            print(f"  Dolby Atmos: {status}")
            if atmos.get('has_atmos'):
                print(f"    Codec: {atmos.get('codec', 'Unknown')}")

        # Loudness
        if results.get('loudness'):
            loud = results['loudness']
            if loud.get('integrated_loudness') is not None:
                status = "✅ COMPLIANT" if loud.get('is_compliant') else "❌ NON-COMPLIANT"
                print(f"  Loudness: {status}")
                print(f"    Level: {loud['integrated_loudness']:.1f} LUFS")

        # Full JSON output
        print("\n" + "=" * 70)
        print("📄 Full JSON Output:")
        print("=" * 70)
        print(json.dumps(results, indent=2, default=str))

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function"""
    print("\n" + "=" * 70)
    print("  L1 Headend Monitor - Test Suite")
    print("=" * 70)

    # Get input URL
    if len(sys.argv) > 1:
        input_url = sys.argv[1]
    else:
        # Default test URL
        input_url = "udp://225.3.3.42:30130"
        print(f"\nℹ️  Using default input: {input_url}")
        print(f"   To test another input: python3 test_l1_monitor.py <input_url>")

    # Get duration
    duration = 10
    if len(sys.argv) > 2:
        try:
            duration = int(sys.argv[2])
        except ValueError:
            print(f"⚠️  Invalid duration, using default: {duration}s")

    print(f"\n🎯 Target: {input_url}")
    print(f"⏱️  Analysis Duration: {duration} seconds")

    # Initialize monitor
    try:
        monitor = L1HeadendMonitor()
        print("✅ L1 Monitor initialized")
    except Exception as e:
        print(f"❌ Failed to initialize L1 Monitor: {e}")
        return 1

    # Menu
    print("\n" + "=" * 70)
    print("Select test to run:")
    print("=" * 70)
    print("  1. Stream Information (quick)")
    print("  2. TR 101 290 Analysis (~10s)")
    print("  3. HDR Metadata Check (quick)")
    print("  4. Dolby Atmos Detection (quick)")
    print("  5. Audio Loudness Measurement (~10s)")
    print("  6. Complete L1 Analysis (all tests, ~2 minutes)")
    print("  0. Exit")
    print("=" * 70)

    choice = input("\nEnter choice (1-6, or 0 to exit): ").strip()

    tests = {
        '1': lambda: test_stream_info(monitor, input_url),
        '2': lambda: test_tr101290(monitor, input_url, duration),
        '3': lambda: test_hdr(monitor, input_url, duration),
        '4': lambda: test_atmos(monitor, input_url),
        '5': lambda: test_loudness(monitor, input_url, duration),
        '6': lambda: test_full_analysis(monitor, input_url, duration),
    }

    if choice == '0':
        print("\n👋 Exiting...")
        return 0

    if choice not in tests:
        print(f"\n❌ Invalid choice: {choice}")
        return 1

    # Run selected test
    start_time = datetime.now()
    success = tests[choice]()
    elapsed = (datetime.now() - start_time).total_seconds()

    # Print summary
    print("\n" + "=" * 70)
    print("  Test Summary")
    print("=" * 70)
    print(f"Result: {'✅ SUCCESS' if success else '❌ FAILED'}")
    print(f"Time: {elapsed:.1f} seconds")
    print("=" * 70)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
