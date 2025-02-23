package com.timetorender;

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider
import kotlin.collections.listOf
import com.facebook.react.uimanager.ViewManager

class TimeToRenderPackage : BaseReactPackage() {

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
            listOf(TimeToRenderViewManager(reactContext))

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
            if (name == TimeToRenderModule.NAME) {
                TimeToRenderModule(reactContext)
            } else {
                null
            }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
                TimeToRenderModule.NAME to ReactModuleInfo(
                        TimeToRenderModule.NAME,
                        TimeToRenderModule.NAME,
                        false, // canOverrideExistingModule
                        false, // needsEagerInit
                        true, // hasConstants
                        false, // isCxxModule
                        true // isTurboModule
                )
        )
    }
}
