package com.sosecure.app

import android.view.KeyEvent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "VolumeButton")
class VolumeButtonPlugin : Plugin() {

    private var isListening = false

    @PluginMethod
    fun startListening(call: PluginCall) {
        isListening = true
        call.resolve()
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        isListening = false
        call.resolve()
    }

    fun handleOnKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (!isListening) return false

        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> {
                val data = JSObject().apply {
                    put("button", if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) "up" else "down")
                    put("timestamp", System.currentTimeMillis())
                }
                notifyListeners("volumeButtonPressed", data)
                true
            }
            else -> false
        }
    }
}
