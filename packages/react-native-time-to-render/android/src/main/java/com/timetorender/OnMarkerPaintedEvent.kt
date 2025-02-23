package com.timetorender

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class OnMarkerPaintedEvent(surfaceId: Int, viewId: Int, val paintTime: Long) : Event<OnMarkerPaintedEvent>(surfaceId, viewId) {

    @Deprecated("")
    constructor(viewId: Int, paintTime: Long) : this(-1, viewId, paintTime) {
    }

    override fun getEventName() = EVENT_NAME

    override protected fun getEventData(): WritableMap {
        val eventData: WritableMap = Arguments.createMap()
        eventData.putDouble("paintTime", paintTime.toDouble())
        eventData.putInt("target", getViewTag())
        return eventData
    }

    companion object {
        const val EVENT_NAME = "topMarkerPainted"
    }
}
