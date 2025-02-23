package com.timetorender

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.timetorender.NativeTimeToRenderSpec

class TimeToRenderModule(reactContext: ReactApplicationContext) : NativeTimeToRenderSpec(reactContext) {

  override fun getName() = NAME

  override fun startMarker(name: String, time: Double) {
    MarkerStore.mainStore.startMarker(name, time.toLong())
  }

  companion object {
    const val NAME = "TimeToRender"
  }
}
