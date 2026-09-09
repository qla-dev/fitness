import { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import FormInput from '../FormInput';
import {
  connectSensor,
  forgetSensor,
  getSensorSnapshot,
  scanSensors,
  setWheelCircumference,
  stopSensorScan,
  subscribeSensors,
} from '../../services/recording/sensors';
import { parseDecimalInput } from '../../utils/numericInput';

export default function SensorPanel() {
  const { t } = useTranslation();
  const sensors = useSyncExternalStore(subscribeSensors, getSensorSnapshot);
  const [wheel, setWheel] = useState(String(sensors.wheelMm));
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => stopSensorScan(), []);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await operation();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-3 py-3">
      <Text className="text-text-primary font-semibold">
        {t('recording.sensors', { defaultValue: 'Bluetooth sensors' })}
      </Text>
      <Text className="text-text-muted text-sm">
        {t('recording.sensorHelp', {
          defaultValue:
            'Wake your sensor before connecting. Paired sensors reconnect automatically when available.',
        })}
      </Text>
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          disabled={busy}
          onPress={() => void run(() => scanSensors('heartRate'))}
        >
          {t('recording.findHeartRate', {
            defaultValue: 'Find heart-rate strap',
          })}
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          disabled={busy}
          onPress={() => void run(() => scanSensors('bike'))}
        >
          {t('recording.findBikeSensor', { defaultValue: 'Find bike sensor' })}
        </Button>
      </View>
      {sensors.scanning && (
        <Button variant="ghost" onPress={stopSensorScan}>
          {t('recording.stopScan', { defaultValue: 'Stop scanning' })}
        </Button>
      )}
      {(error || sensors.error) && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('recording.sensorError', {
            defaultValue:
              'Could not connect. Check Bluetooth, sensor battery, and permissions, then retry.',
          })}
        </Text>
      )}
      {sensors.devices.map((device) => (
        <View
          key={device.id}
          className="gap-1 border-b border-border-subtle pb-2"
        >
          <Text className="text-text-primary">{device.name}</Text>
          <Text className="text-text-muted">
            {device.status === 'connected'
              ? t('recording.connected', { defaultValue: 'Connected' })
              : device.status === 'disconnected'
                ? t('recording.disconnected', { defaultValue: 'Disconnected' })
                : t('recording.connecting', { defaultValue: 'Connecting…' })}
          </Text>
          <View className="flex-row gap-2">
            {device.status === 'disconnected' && (
              <Button
                variant="secondary"
                disabled={busy}
                onPress={() => void run(() => connectSensor(device.id))}
              >
                {t('recording.reconnect', { defaultValue: 'Reconnect' })}
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onPress={() => void run(() => forgetSensor(device.id))}
            >
              {t('recording.forget', { defaultValue: 'Forget sensor' })}
            </Button>
          </View>
        </View>
      ))}
      {sensors.discovered
        .filter((d) => !sensors.devices.some((saved) => saved.id === d.id))
        .map((device) => (
          <Button
            key={device.id}
            variant="outline"
            disabled={busy}
            onPress={() => void run(() => connectSensor(device.id))}
          >
            {device.name}
          </Button>
        ))}
      <Text className="text-text-muted">
        {t('recording.wheel', { defaultValue: 'Wheel circumference (mm)' })}
      </Text>
      <FormInput
        accessibilityLabel={t('recording.wheel', {
          defaultValue: 'Wheel circumference (mm)',
        })}
        value={wheel}
        onChangeText={setWheel}
        keyboardType="numeric"
      />
      <Button
        variant="secondary"
        disabled={busy}
        onPress={() =>
          void run(() => setWheelCircumference(parseDecimalInput(wheel)))
        }
      >
        {t('recording.saveWheel', { defaultValue: 'Save wheel size' })}
      </Button>
    </View>
  );
}
