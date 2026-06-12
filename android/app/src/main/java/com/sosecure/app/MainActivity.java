package com.sosecure.app;

import android.os.Build;
import android.view.KeyEvent;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        registerPlugin(VolumeButtonPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (getBridge() == null) return super.onKeyDown(keyCode, event);
            com.getcapacitor.PluginHandle handle = getBridge().getPlugin("VolumeButton");
            VolumeButtonPlugin plugin = handle != null ? (VolumeButtonPlugin) handle.getInstance() : null;
            if (plugin != null && plugin.onVolumeButton(keyCode)) {
                return true; // consumido: no cambia el volumen del sistema
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}
