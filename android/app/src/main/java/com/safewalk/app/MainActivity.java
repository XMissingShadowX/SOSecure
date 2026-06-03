package com.safewalk.app;

import com.getcapacitor.BridgeActivity;
import com.safewalk.app.VolumeButtonPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(VolumeButtonPlugin.class);
        super.onCreate(savedInstanceState);
    }
}