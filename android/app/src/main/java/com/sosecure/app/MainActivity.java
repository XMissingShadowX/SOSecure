package com.sosecure.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(VolumeButtonPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
