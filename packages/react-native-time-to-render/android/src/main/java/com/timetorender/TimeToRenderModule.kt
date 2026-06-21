package com.timetorender

import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.ReactApplicationContext
import com.timetorender.NativeTimeToRenderSpec

class TimeToRenderModule(reactContext: ReactApplicationContext) : NativeTimeToRenderSpec(reactContext) {

  override fun getName() = NAME

  override fun startMarker(name: String, time: Double) {
    MarkerStore.mainStore.startMarker(name, time.toLong())
  }

  override fun getThermalState(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "unknown"
    val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    return when (powerManager.currentThermalStatus) {
      PowerManager.THERMAL_STATUS_NONE -> "nominal"
      PowerManager.THERMAL_STATUS_LIGHT, PowerManager.THERMAL_STATUS_MODERATE -> "fair"
      PowerManager.THERMAL_STATUS_SEVERE -> "serious"
      else -> "critical" // CRITICAL | EMERGENCY | SHUTDOWN
    }
  }

  override fun getForcedFlags(): String = currentActivity?.intent?.getStringExtra("rnFlags") ?: ""

  companion object {
    const val NAME = "TimeToRender"
  }
}
