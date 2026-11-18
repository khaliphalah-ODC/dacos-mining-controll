> Security update: operational screens now require login. ADMIN/SUPERVISOR roles
> can issue pairing codes and manage devices. Follow
> [SECURITY_AND_MANAGEMENT.md](SECURITY_AND_MANAGEMENT.md) to create the first admin.
> Pairing redemption and device telemetry retain separate device authorization.
> The historical verification results below describe the pre-authentication version.

# Device connectivity lab

This extends the existing Vue/Pinia, Express/Socket.IO and PostgreSQL application.
It is a prototype using fictional workers, including the new **W-014 / Amina Johnson**.
A simulated SOS is a database event and dashboard alert only. It never calls responders.

## Quick start on the laptop

```bash
./scripts/npm run dev
```

Startup applies the new migration. If dependencies were already installed before
this change, first run `./scripts/npm run db:generate` to update Prisma Client.
Open `http://localhost:5173/workers`, then **W-014 →**. All loaded worker IDs
have detail links; the existing directory and inspectors remain available.
Open `http://localhost:5173/device-simulator` in another tab.
Create a code, choose W-014, paste the code and pair. Start transmission, change
values and wait up to three seconds. The Worker Detail updates through Socket.IO.
Click **SIMULATED SOS** to add an explicitly simulated alert and timeline entry.
Use **Stop safely** before closing the simulator.

Only unassigned fictional workers appear in the pairing selector. One active
registration per worker prevents simulator data silently replacing hardware data.
If you close/reload a paired tab, its token is lost deliberately. From the laptop
localhost simulator page, revoke that registration and create a fresh code.
Revocation invalidates the old token and frees the worker; stored packets and SOS
history remain. Pairing codes are single-use, expire in two minutes, and are held
only in server memory. Device tokens are tab-only and stored as hashes on the server.

## Phone on the same Wi-Fi network: private HTTPS

Wi-Fi is the network route from the phone browser to Express. BLE is a nearby
radio link from a peripheral to the gateway browser; that browser still needs
an HTTP(S) connection to Express. The phone simulator sends the numbers entered
by the user; it does not read the phone's health sensors or create random data.

The API stays on laptop loopback. Vite retains its loopback listener and, only when opted in, shares its HTTPS
application on a second listener at the laptop's specific private IPv4 address. Nothing in these instructions requires a public
IP address, port forwarding, a cloud tunnel or production deployment.

1. Put the laptop and phone on the same trusted private network. Find the
   laptop's private address (for example `192.168.1.20`). Guest Wi-Fi with client
   isolation may block connections.
2. Obtain a **locally trusted development certificate** covering that IP address,
   `localhost` and `127.0.0.1`. An existing local CA/tool such as mkcert may be used;
   no SDK or certificate tool is installed by this change. Install that CA's
   public root certificate on your test phone using its platform's certificate
   settings. Keep the CA private key and server private key on the laptop.
   Do not bypass browser certificate errors: an untrusted HTTPS page may fail
   secure-context checks or Web Bluetooth permissions.
3. Stop an existing dev instance. Start with your own certificate paths:

   ```bash
   DEVICE_LAN_HOST=192.168.1.20 \
   DEVICE_TLS_CERT=/absolute/path/dev-cert.pem \
   DEVICE_TLS_KEY=/absolute/path/dev-key.pem \
   ./scripts/npm run dev
   ```

4. On the laptop open `https://localhost:5173/device-simulator` and create a code.
   On Android Chrome open `https://192.168.1.20:5173/device-simulator`, enter that
   code, select W-014, and pair. The laptop page is required to issue or revoke
   pairings; the phone's LAN origin cannot issue them.
5. Start transmission. Keep the phone tab in the foreground and watch
   `https://localhost:5173/workers/W-014` on the laptop. Background throttling or
   locking a phone can pause JavaScript. This is not an always-on wearable link.

The full `npm run dev` command keeps localhost available and adds the explicit
private-address HTTPS listener. Do not override its host with `0.0.0.0`.
Plain `http://192.168…` is rejected. The development TLS configuration fails if
only one key/certificate is supplied or if the host is not a private IPv4 address.
Firewall access, certificate trust and the LAN address are local setup steps;
they have not been changed automatically.

For a local USB alternative, if Android platform-tools/ADB is already available
and you have approved USB debugging, `adb reverse tcp:5173 tcp:5173` lets Android
Chrome open `http://localhost:5173`. The traffic then uses the approved USB
connection, not Wi-Fi. Disconnect/revoke USB debugging after testing. This is
an optional alternative; no Android Studio or platform SDK is required by DACOS.

## BLE gateway

Open `/ble-gateway` on a browser/device exposing `navigator.bluetooth` in a
secure context. Create a pairing code from the laptop simulator page, choose
an available fictional worker and register the gateway. Then click **Choose BLE
peripheral**; the browser asks you to approve one compatible peripheral.

The standard mode requests Heart Rate Service **0x180D** and Heart Rate
Measurement **0x2A37**. It subscribes to notifications when available, or reads a
readable characteristic once. The flags byte selects an 8-bit or little-endian
16-bit heart rate. Truncated optional fields, absent supported skin contact and
out-of-range values are rejected. Optional RR/energy fields are validated for
length but are not displayed as additional measurements. Unknown vendor formats
are never guessed. SpO₂, temperature and battery remain **Unavailable** when the
peripheral only exposes heart rate.

The gateway displays its browser peripheral ID, radio connection state and last
measurement time. DACOS's registration UUID is a separate backend device ID.
High-frequency notifications are sampled at at most one relay per second.
After radio loss, listeners are removed. **Reconnect selected peripheral** makes
an explicit fresh connection and characteristic subscription. No unattended
retry loop runs. **Disconnect safely** disconnects radio and posts a final
connection packet. Closing the page disconnects radio; the server's timeout
handles loss where a final network request cannot be delivered.

Chrome's documentation describes supported platforms and secure-context/user
activation requirements: [Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth).
Android Chrome is the preferred phone test path. Feature detection governs the
UI; support is not universal across browser/OS combinations. Firefox and iOS
Safari should use the fallback path. Linux Chromium support depends on the
browser build and OS configuration. Consult that guide rather than assuming
all Chromium installations expose Web Bluetooth.

A compatible heart-rate strap or programmable BLE board is sufficient. A
smartwatch must explicitly advertise the supported service and allow access;
many expose data only through a vendor app or authenticated proprietary API.
A browser cannot turn an arbitrary phone into a BLE peripheral. To use another
phone as the peripheral, install a compatible **native BLE peripheral app** that
can advertise the service and publish the exact characteristic bytes. Android
advertising depends on hardware/OS support; iOS native apps have service and
background advertising restrictions. A BLE scanner-only app cannot simulate a
peripheral. No native peripheral app is bundled here.

### DACOS demo GATT format

Select **DACOS demo peripheral** before registration so provenance is `simulator`.
Default service UUID: `7a1d0001-6e5a-4c21-9b7d-5d41434f5300`.
Default characteristic: `7a1d0002-6e5a-4c21-9b7d-5d41434f5300`.
UUIDs are configurable, but the payload format always stays demo v1:

| Offset | Bytes | Format | Meaning |
| --- | --- | --- | --- |
| 0 | 1 | unsigned byte | Version, exactly 1 |
| 1 | 2 | unsigned little-endian | Heart rate, bpm, 0–250 |
| 3 | 2 | signed little-endian | Temperature in hundredths °C, 2000–5000 |
| 5 | 1 | unsigned byte | SpO₂ %, 0–100 |
| 6 | 1 | unsigned byte | Battery %, 0–100 |

Example hex: `01 4e 00 7e 0e 62 5c` = 78 bpm, 37.10°C, 98%, 92%.
Exactly seven bytes are required. Advertise the service and configure the
characteristic for notifications (preferred) or read. This is a DACOS-defined
format; it is not a smartwatch industry standard.
Standard heart-rate format reference: [Bluetooth SIG Heart Rate Service](https://www.bluetooth.com/wp-content/uploads/Files/Specification/HTML/HRS_v1.0/out/en/index-en.html).

### Fallback gateway

When browser BLE is unavailable, use the Wi-Fi simulator to verify the full
backend/display path, or implement a native BLE central using your platform's
GATT API. Pair that gateway using the same single-use registration request,
read only the documented services, and POST the common contract below over
trusted HTTPS. A native gateway binary is not included; actual BLE use requires
a compatible peripheral and supported browser, or a separately supplied native
central. A browser unsupported message is not a claim of hardware connectivity.

## Common HTTP contract and persistence

`POST /api/device-pairing` on laptop localhost returns `{ code, expiresAt }`.
`POST /api/devices/register` takes `{ code, workerId, transport, source }` and
returns `{ deviceId, workerId, transport, source, token }` once.
`POST /api/devices/:id/revoke` is laptop-local and preserves history.

Send `Authorization: Bearer <token>` to `POST /api/device-telemetry`:

```json
{
  "deviceId": "UUID returned by registration",
  "workerId": "W-014",
  "transport": "wifi",
  "source": "simulator",
  "timestamp": "2026-11-14T12:00:00.000Z",
  "sequence": 0,
  "connectionStatus": "connected",
  "quality": "simulated",
  "metrics": [{ "metric": "heartRate", "value": 78, "unit": "bpm" }],
  "sos": false
}
```

Use the current UTC timestamp; the example is not a reusable timestamp. BLE
uses transport `ble-gateway`. Hardware uses source `hardware`, quality `live`;
`live` records provenance, not medical validation. Demo BLE and Wi-Fi simulator
use source `simulator`, quality `simulated`. SOS is accepted only for simulator
registrations. Units and metric ranges are validated with shared Zod schemas.

Sequence numbers increase for each request in a registration. Duplicate last
sequences are acknowledged without another write; older sequences or timestamps
return 409. Reading timestamps must be within two minutes of receipt. The
server adds `receivedAt`; it never trusts the client to supply that time.
Registration identity, transport and source must match the token. The body limit
is 16 KiB. Authenticated submissions are limited to two attempts per second per
device; the UI transmits every three seconds (Wi-Fi) or at most once per second
(BLE). Responses use 400 invalid, 401 unauthorized, 403 forbidden, 409 conflict,
413 too large and 429 too frequent. Native clients must use a trusted HTTPS
proxy that preserves the Host header and sends the matching HTTPS Origin;
that proxy must forward only to the loopback API. No public API is configured.

`DeviceRegistration` stores the token hash and last accepted packet state.
`DeviceTelemetry` appends accepted packets, receipt timestamps and sequence IDs.
`IncidentEvent` appends simulated SOS events. These tables survive scenario
changes and restarts. Packet and SOS writes happen in one database transaction.
There is no automatic history retention/deletion policy yet; long tests grow
these tables. Tokens never appear in API reads or Socket.IO snapshots.

Existing scenario snapshots keep their original contracts/events. Optional
`deviceSessions` and `deviceEvents` fields extend the snapshot. Pinia uses a
paired device's metrics before fictional fixture metrics, and does not fill
missing paired metrics with invented values. Worker Detail also shows
zone readings and last-known fictional coordinates from the existing simulator.
Connection ages are calculated separately from worker safety: no receipt is
unavailable, explicit stop is disconnected, 10 seconds without packets is stale,
and 30 seconds is disconnected. Scenario ticks never refresh device timestamps.
Socket loss is also shown independently. Last-known values remain labelled with
provenance and timestamps. Simulated SOS alerts remain visible with their history;
acknowledgement/resolution of test SOS is a future workflow.

## Troubleshooting and stopping

- Cannot reach phone page: check the specific private IP, same LAN, firewall,
  certificate SANs/trust and Wi-Fi client isolation. No router forwarding needed.
- Pairing fails: generate a new code on laptop localhost; codes expire after two
  minutes and cannot be reused. Revoke an old registration if the worker is taken.
- 401: registration was revoked, token missing, or wrong token. Re-pair securely.
- 409: advance sequence and timestamp; use a new registration after losing tab
  credentials. Do not replay old readings as fresh measurements.
- 429: wait at least 500ms. BLE forwarding already coalesces fast notifications.
- BLE chooser empty: enable Bluetooth/permissions and verify the peripheral
  advertises the selected service, is in range, and is not occupied by another app.
- Decode error: check the flags/length or demo byte layout. Do not switch parsers
  to guess a vendor format. Unsupported measurements stay unavailable.
- No update: check the latest server acknowledgement, keep the tab foreground,
  and check device timestamps and browser-to-backend connection status separately.
- Use Stop safely / Disconnect safely, then revoke pairing if done. Stop the
  development app with Ctrl+C. If a tab crashes, wait for the stale/disconnected
  timeout; no emergency responders are contacted.

## Verification and implementation map

Run `./scripts/npm test` and `./scripts/npm run build`. Tests cover contracts,
authorization, rate/order checks, state aging, simulated SOS, PostgreSQL restart
recovery, Worker Detail rendering and mocked BLE GATT subscriptions. They do not
replace a physical Android/TLS or BLE hardware test.

The shared contract is the agreed packet shape. The device service checks the
sender and ordering. The repository transaction saves the packet and SOS event
together. The telemetry service adds saved device state to its existing snapshot
and publishes it. Pinia receives that same snapshot for every view. The detail
view selects one worker; the Wi-Fi form and BLE gateway both use one sender
helper. This keeps browser display logic separate from device decoding and
backend persistence, without replacing the existing simulator.

### Files added or changed

- Screens: `frontend/src/views/WorkerDetailView.vue`, `DeviceSimulatorView.vue`,
  `BleGatewayView.vue`; directory links in `WorkersView.vue` and routes in `router.js`.
- Browser logic: `frontend/src/services/worker-detail.js`, `device-client.js`,
  `ble-gateway.js`; device-aware metrics in `frontend/src/stores/telemetry.js`.
- Styling and private HTTPS: `frontend/src/styles.css`, `frontend/vite.config.js`.
- Backend: `backend/src/services/devices.js`, `services/telemetry.js`, `app.js`,
  `repositories/postgres.js`; W-014 in `simulation/fixtures.js`.
- Contracts and database: `shared/contracts.js`, `backend/prisma/schema.prisma`,
  new migrations `202611140001_device_connectivity` and `202611140002_device_measurement_time`.
- Verification: `backend/tests/devices.test.js`, expanded `backend/tests/api.test.js`,
  `frontend/tests/connectivity.test.js`, `worker-detail-ui.test.js`,
  `frontend/scripts/check-connectivity.mjs`, Vue support in `vitest.config.js`.
- Documentation: this guide, `docs/PROJECT_GUIDE.md`, `docs/backend.md`, `README.md`.

Automated verification completed with 23 tests across seven files, the frontend
production build, and existing Chrome checks for all original screens/scenarios.
The new Chrome check exercised UI pairing, 81-bpm transmission, simulated SOS,
worker updates and all three new screens at 1440/768/390/360 pixels. The test
registration was revoked afterward; its deliberately append-only simulated SOS
remains in the local demo database. An ephemeral certificate test also verified
HTTPS on loopback and the private interface, API proxying, and rejection of LAN
pairing administration. That transport check used a self-signed test fixture;
phone certificate trust and physical BLE behavior still require hardware testing.
The build emits third-party Zod comment-annotation warnings but succeeds.

For firmware provisioning and the hardware packet contract, see [ESP32_S3_TELEMETRY.md](ESP32_S3_TELEMETRY.md).
