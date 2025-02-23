package com.timetorender

import java.util.Date
import kotlin.collections.mutableMapOf
import android.os.SystemClock

class MarkerStore(private val markers: MutableMap<String, Long> = mutableMapOf()) {

    companion object {
        val mainStore = MarkerStore()
        fun JSTimeIntervalSinceStartup() = SystemClock.uptimeMillis()
    }

    fun startMarker(marker: String, timeSinceStartup: Long) {
        markers.put(marker, timeSinceStartup)
    }

    fun endMarker(marker: String) : Long {
        val markerStart = markers[marker]
        val markerEnd = JSTimeIntervalSinceStartup()
        markers.remove(marker)
        return markerEnd - markerStart!!
    }
}
