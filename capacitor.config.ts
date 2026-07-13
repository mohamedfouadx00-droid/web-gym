/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.gymlifecoach.app',
  appName: 'GYM Life Coach',
  webDir: 'dist',
  android: {
    backgroundColor: '#0e1826',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_gym',
      iconColor: '#56D39B',
      sound: 'coach_reminder.wav',
    },
  },
}

export default config
