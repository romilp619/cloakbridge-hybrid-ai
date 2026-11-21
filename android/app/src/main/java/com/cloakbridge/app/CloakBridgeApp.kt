package com.cloakbridge.app

import android.app.Application
import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.initialize
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings

class CloakBridgeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(context = this)

        // Configure Firebase App Check (debug token in debug builds, Play Integrity in release)
        if (BuildConfig.DEBUG) {
            Firebase.appCheck.installAppCheckProviderFactory(
                DebugAppCheckProviderFactory.getInstance()
            )
            Log.i("CloakBridgeApp", "Installed Firebase App Check Debug provider.")
        } else {
            Firebase.appCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        // Initialize Remote Config with offline-safe defaults
        val rc = Firebase.remoteConfig
        rc.setConfigSettingsAsync(
            remoteConfigSettings {
                minimumFetchIntervalInSeconds = 60
            }
        )
        rc.setDefaultsAsync(R.xml.remote_config_defaults)
    }
}
