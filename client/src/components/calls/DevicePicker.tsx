import React, { useState } from 'react';
import { useMediaDevices, useMediaDeviceSelect } from '@livekit/components-react';
import { ChevronDown, Mic, Video, Check } from 'lucide-react';

interface DevicePickerProps {
  kind: 'audioinput' | 'videoinput';
  onSelect?: (deviceId: string) => void;
}

export const DevicePicker: React.FC<DevicePickerProps> = ({ kind, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const devices = useMediaDevices({ kind });
  const { activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });

  const handleSelect = (deviceId: string) => {
    setActiveMediaDevice(deviceId);
    onSelect?.(deviceId);
    setIsOpen(false);
  };

  const selectedDevice = devices.find((d) => d.deviceId === activeDeviceId);
  const Icon = kind === 'audioinput' ? Mic : Video;
  const displayName = selectedDevice?.label || (kind === 'audioinput' ? 'Default Mic' : 'Default Camera');

  return (
    <div className="relative">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10  border border-white/15 hover:bg-white/20 text-[11px] text-white/70 hover:text-white transition-colors"
        title={`Select ${kind === 'audioinput' ? 'microphone' : 'camera'}`}
      >
        <Icon className="w-3 h-3" />
        <span className="truncate max-w-[80px]">{displayName}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && devices.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 w-56 max-h-48 overflow-y-auto bg-zinc-900  border border-white/10 rounded-xl shadow-pop py-1 animate-in slide-in-from-bottom-2 fade-in duration-150">
            {devices.map((device) => (
              <button type="button"
                key={device.deviceId}
                onClick={() => handleSelect(device.deviceId)}
                className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white/10 transition-colors flex items-center gap-2 ${
                  device.deviceId === activeDeviceId ? 'text-wa-accent bg-wa-accent/10' : 'text-zinc-300'
                }`}
              >
                <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
                {device.deviceId === activeDeviceId && (
                  <Check className="ml-auto w-3 h-3 text-wa-accent" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
