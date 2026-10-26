package com.carrollj13633.traillog;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Small local plugin that covers what the background-geolocation plugin does not:
 * separate runtime-permission requests (foreground location, "all the time" location,
 * notifications), status checks, and shortcuts to the relevant Android settings screens.
 *
 * Nothing here reads or transmits location data.
 */
@CapacitorPlugin(
    name = "TrailLogNative",
    permissions = {
        @Permission(
            alias = "foreground",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        ),
        @Permission(alias = "background", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class TrailLogNativePlugin extends Plugin {

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean declared(String permission) {
        try {
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 33) {
                info = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(),
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS)
                );
            } else {
                info = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(),
                    PackageManager.GET_PERMISSIONS
                );
            }
            if (info.requestedPermissions != null) {
                for (String p : info.requestedPermissions) {
                    if (permission.equals(p)) return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean locationEnabled() {
        Context c = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
            return lm != null && lm.isLocationEnabled();
        }
        return Settings.Secure.getInt(c.getContentResolver(), Settings.Secure.LOCATION_MODE, Settings.Secure.LOCATION_MODE_OFF)
            != Settings.Secure.LOCATION_MODE_OFF;
    }

    private JSObject status() {
        JSObject o = new JSObject();
        boolean fine = granted(Manifest.permission.ACCESS_FINE_LOCATION);
        boolean coarse = granted(Manifest.permission.ACCESS_COARSE_LOCATION);
        // 'granted' = precise + coarse; 'approximate' = user picked "Approximate" only.
        o.put("foreground", fine && coarse ? "granted" : (coarse ? "approximate" : "denied"));

        boolean bgDeclared = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && declared(Manifest.permission.ACCESS_BACKGROUND_LOCATION);
        o.put("backgroundDeclared", bgDeclared);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            o.put("background", "granted"); // no separate permission before Android 10
        } else {
            o.put("background", granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION) ? "granted" : "denied");
        }

        if (Build.VERSION.SDK_INT >= 33) {
            o.put("notifications", granted(Manifest.permission.POST_NOTIFICATIONS) ? "granted" : "denied");
        } else {
            o.put("notifications", "granted"); // no runtime permission before Android 13
        }

        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean unrestricted = true;
        boolean powerSave = false;
        if (pm != null) {
            unrestricted = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            powerSave = pm.isPowerSaveMode();
        }
        o.put("batteryUnrestricted", unrestricted);
        o.put("powerSave", powerSave);
        o.put("locationEnabled", locationEnabled());
        o.put("sdk", Build.VERSION.SDK_INT);
        o.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        return o;
    }

    @PluginMethod
    public void checkStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestForeground(PluginCall call) {
        if (granted(Manifest.permission.ACCESS_FINE_LOCATION) && granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("foreground", call, "statusCallback");
    }

    @PluginMethod
    public void requestBackground(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
            call.resolve(status());
            return;
        }
        if (!granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
            // Android requires foreground location first.
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("background", call, "statusCallback");
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS)) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("notifications", call, "statusCallback");
    }

    @PermissionCallback
    private void statusCallback(PluginCall call) {
        call.resolve(status());
    }

    private void launch(PluginCall call, Intent intent, Intent fallback) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Could not open settings.");
            }
        }
    }

    private Intent appDetails() {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        return i;
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        launch(call, appDetails(), new Intent(Settings.ACTION_SETTINGS));
    }

    /** Opens the system battery-optimization list (no special permission needed), else the app's details page. */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        launch(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), appDetails());
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        launch(call, new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS), appDetails());
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        launch(call, i, appDetails());
    }
}
