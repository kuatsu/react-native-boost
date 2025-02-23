package com.timetorender

import android.content.Context
import android.graphics.Canvas
import android.util.AttributeSet
import android.view.View
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper

class TimeToRenderView  : View {
    var _alreadyLogged = false
    var _markerName: String? = ""
    constructor(context: Context?) : super(context) {
        configureComponent()
    }

    constructor(context: Context?, attrs: AttributeSet?) : super(context, attrs) {
        configureComponent()
    }

    constructor(context: Context?, attrs: AttributeSet?, defStyleAttr: Int) : super(context, attrs, defStyleAttr) {
        configureComponent()
    }

    fun setMarkerName(markerName: String?) {
        _markerName = markerName
    }

    private fun configureComponent() {
        // do nothing
    }

    override protected fun onDraw(canvas: Canvas) {
        if (getParent() != null && !_alreadyLogged) {
            _alreadyLogged = true
            val paintTime = MarkerStore.mainStore.endMarker(_markerName!!)
            android.util.Log.e("DAVID", "Logging end of marker: $paintTime")
            val reactContext: ReactContext = getContext() as ReactContext
            val reactTag: Int = getId()
            UIManagerHelper.getEventDispatcherForReactTag(reactContext, reactTag)
                    ?.dispatchEvent(
                            OnMarkerPaintedEvent(
                                    UIManagerHelper.getSurfaceId(reactContext), reactTag, paintTime))
        }
    }
}
