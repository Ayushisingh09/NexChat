import React, { useCallback } from 'react';
import { useMediaDevices, useMediaDeviceSelect } from '@livekit/components-react';
import { SwitchCamera } from 'lucide-react';

export const CameraSwitchButton: React.FC = () => {
  const devices = useMediaDevices({ kind: 'videoinput' });
  const { activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'videoinput' });

  const handleSwitch = useCallback(() => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveMediaDevice(devices[nextIndex].deviceId);
  }, [devices, activeDeviceId, setActiveMediaDevice]);

  if (devices.length < 2) return null;

  return (
    <button type="button"
      onClick={handleSwitch}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10  border border-white/15 hover:bg-white/20 text-[11px] text-white/70 hover:text-white transition-colors"
      title="Switch camera"
    >
      <SwitchCamera className="w-3 h-3" />
      <span>Flip</span>
    </button>
  );
};
