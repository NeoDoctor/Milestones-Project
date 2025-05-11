package com.neonatal.milestones;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class LauncherActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create a WebView programmatically
        webView = new WebView(this);
        setContentView(webView);
        
        // Configure service worker if supported
        try {
            ServiceWorkerController controller = ServiceWorkerController.getInstance();
            controller.setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    // Allow service worker to handle requests
                    return null;
                }
            });
        } catch (Exception e) {
            // Service worker API may not be available on all devices
            e.printStackTrace();
        }
        
        // Enable JavaScript
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        
        // Enable DOM storage, caching, and offline functionality
        webSettings.setDomStorageEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setDatabaseEnabled(true);
        
        // Set app cache path and enable app cache (for older Android versions)
        String appCachePath = getApplicationContext().getCacheDir().getAbsolutePath();
        webSettings.setAppCachePath(appCachePath);
        try {
            webSettings.setAppCacheEnabled(true);
        } catch (Exception e) {
            // AppCache might be deprecated in newer WebView versions
            e.printStackTrace();
        }
        
        // Allow file access so that the PWA can load files from the assets directory
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        
        // Set WebView client to handle navigation
        webView.setWebViewClient(new WebViewClient());
        
        // Load the PWA from assets folder
        webView.loadUrl("file:///android_asset/web/index.html");
    }
    
    @Override
    public void onBackPressed() {
        // Handle back button press to navigate within the web app
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}