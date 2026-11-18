# Future ESP32-S3 telemetry integration

This documents the existing validated contract; no firmware or physical sensor
connection is claimed. First verify supported sensors and units on your actual
board. Unknown/unavailable measurements must be omitted, never replaced by zero
or random values. Hardware data is not medically or mine-safety validated here.

## Provisioning

An ADMIN/SUPERVISOR registers an inventory device, chooses transport `wifi` and
source `hardware`, assigns an active worker, then reprovisions it. The result
contains `device.id`, a one-time bearer token and `nextSequence`. Install the
credential through an appropriately protected local provisioning process. Store
it using the hardware/platform's secure storage facilities; never commit it to
firmware source, send it to serial logs or use a human session cookie on firmware.
The board must verify the HTTPS server certificate/hostname using a trusted CA.
The local prototype API remains loopback-only; use the documented trusted private
HTTPS frontend/proxy, not a public development-port exposure. Native senders must
send the matching HTTPS Origin and Host expected by the local gateway policy.
Do not send the laptop-only local-client override header.

## Packet

POST `/api/device-telemetry` with `Content-Type: application/json` and
`Authorization: Bearer <device-token>`:

```json
{
  "deviceId": "registration UUID",
  "workerId": "assigned worker ID",
  "transport": "wifi",
  "source": "hardware",
  "timestamp": "2026-11-16T12:00:00.000Z",
  "sequence": 0,
  "connectionStatus": "connected",
  "quality": "live",
  "metrics": [
    { "metric": "heartRate", "value": 78, "unit": "bpm" },
    { "metric": "temperature", "value": 37.1, "unit": "°C" },
    { "metric": "spo2", "value": 98, "unit": "%" },
    { "metric": "battery", "value": 92, "unit": "%" }
  ],
  "sos": false
}
```

All numbers above are illustrative. Send only measurements actually supported
and obtained from your sensors. Accepted ranges are validation bounds, not alert
thresholds: heart rate 0–250 bpm, temperature 20–50°C, SpO₂/battery 0–100%.
Unsupported environmental fields require an explicit future shared-contract
extension. Temperature must describe the implemented sensor measurement; do not
label ambient temperature as body temperature.

Use the actual UTC acquisition timestamp in ISO 8601 with Z. Synchronize the
board clock before transmission. Server receipt time is added separately.
Timestamps outside two minutes of server time are rejected. The sequence is a
non-negative integer up to 2147483647 and increases per registration. Persist it
across firmware restarts; rotation/reprovisioning returns the next valid value
and does not reset history. Do not silently restart at zero.

The source/worker/transport must match registration. Standard BLE gateway packets
use transport `ble-gateway`, source `hardware`; documented demo peripheral packets
use source `simulator`, quality `simulated`. Hardware SOS is deliberately rejected
in this prototype. Simulated SOS remains available only for simulator credentials.

## Acknowledgement and failures

Success returns accepted, sequence and receivedAt. A duplicate latest sequence
returns accepted=false/duplicate=true with no additional history write. Older
sequence/timestamp returns 409. Missing/revoked/wrong token returns 401, identity
mismatch 403, invalid values/time 400, oversized bodies 413, excessive rate 429.
Bodies are limited to 16 KiB; send no more than two packets per second. A three
second interval is suitable for demonstrating the current timeout behavior.

Keep acquisition timestamps and sequence stable when retrying an unacknowledged
packet. Do not timestamp an old measurement as newly measured. Use bounded retry
and backoff; do not accumulate an unlimited queue. Offline samples older than the
current acceptance window cannot be uploaded through this live endpoint; a
separate historical-upload contract would be needed. An orderly shutdown can
send connectionStatus=`disconnected` with an empty metrics list. That updates
contact state while preserving the previous measurement timestamp. Device status
becomes stale after 10 seconds and disconnected after 30 seconds without contact.

Credential rotation requires updating the firmware with the new token and next
sequence. Unassignment/reassignment changes the worker ID the board must send;
old-worker packets are rejected. Operational deployment needs physical failure,
clock, reconnection, buffering, power-loss and sensor-calibration tests.
