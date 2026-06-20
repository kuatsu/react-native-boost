import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import type { DeviceInfo, Platform } from './schema.ts';

function tryExec(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** First booted iOS simulator, with its runtime version. */
function detectIosSimulator(): DeviceInfo | null {
  const raw = tryExec('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
  if (!raw) return null;
  const byRuntime = (JSON.parse(raw).devices ?? {}) as Record<string, Array<{ udid: string; name: string }>>;
  for (const [runtime, devices] of Object.entries(byRuntime)) {
    const device = devices[0];
    if (!device) continue;
    const osVersion = runtime.split('iOS-').at(-1)?.replaceAll('-', '.') ?? 'unknown';
    return { platform: 'ios', kind: 'simulator', name: device.name, osVersion, id: device.udid };
  }
  return null;
}

/** First connected physical iOS device (Xcode 15+ `devicectl`). */
function detectIosDevice(): DeviceInfo | null {
  const raw = tryExec('xcrun', ['devicectl', 'list', 'devices', '-j', '-q']);
  if (!raw) return null;
  type Entry = {
    hardwareProperties?: { udid?: string; marketingName?: string; osVersionNumber?: string };
    connectionProperties?: { tunnelState?: string };
  };
  const devices = (JSON.parse(raw)?.result?.devices ?? []) as Entry[];
  for (const device of devices) {
    const udid = device.hardwareProperties?.udid;
    if (!udid || device.connectionProperties?.tunnelState === 'unavailable') continue;
    return {
      platform: 'ios',
      kind: 'device',
      name: device.hardwareProperties?.marketingName ?? 'iOS device',
      osVersion: device.hardwareProperties?.osVersionNumber ?? 'unknown',
      id: udid,
    };
  }
  return null;
}

/** First online adb target (real device preferred over emulator). */
function detectAndroid(): DeviceInfo | null {
  const raw = tryExec('adb', ['devices']);
  if (!raw) return null;
  const serials = raw
    .split('\n')
    .slice(1)
    .map((line) => line.split('\t'))
    .filter(([, state]) => state?.trim() === 'device')
    .map(([serial]) => serial.trim());
  if (serials.length === 0) return null;

  const serial = serials.find((s) => !s.startsWith('emulator-')) ?? serials[0];
  const prop = (key: string): string => tryExec('adb', ['-s', serial, 'shell', 'getprop', key])?.trim() || 'unknown';
  return {
    platform: 'android',
    kind: serial.startsWith('emulator-') ? 'emulator' : 'device',
    name: prop('ro.product.model'),
    osVersion: prop('ro.build.version.release'),
    id: serial,
  };
}

/** Auto-detect a target for `platform`: a real device if present, otherwise a simulator/emulator. */
export function detectDevice(platform: Platform): DeviceInfo {
  const device = platform === 'ios' ? (detectIosDevice() ?? detectIosSimulator()) : detectAndroid();
  if (!device) {
    const hint =
      platform === 'ios' ? 'boot a simulator or connect a device' : 'start an emulator or connect a device (adb)';
    throw new Error(`no ${platform} target found — ${hint}`);
  }
  return device;
}

function lanIp(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  throw new Error('could not determine a LAN IP for the physical device to reach the host');
}

/** Where the app running on `device` should reach the host-bound benchmark server. */
export function resolveHost(device: DeviceInfo): string {
  if (device.kind === 'simulator') return 'localhost'; // iOS sim shares the host network
  if (device.kind === 'emulator') return '10.0.2.2'; // Android emulator's alias for the host
  return lanIp();
}
