package com.divzplit.app;

import java.net.URI;
import java.net.URISyntaxException;

/** Pure URL policy, also exercised on the host JVM before producing a pilot. */
public final class WebViewPolicy {
    private WebViewPolicy() {}

    public static boolean internal(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "divzplit.com".equalsIgnoreCase(uri.getHost())
                    && uri.getRawUserInfo() == null
                    && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (URISyntaxException | NullPointerException error) {
            return false;
        }
    }

    public static boolean external(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if ("https".equalsIgnoreCase(scheme)) {
                return uri.getHost() != null && uri.getRawUserInfo() == null && !internal(value);
            }
            return "mailto".equalsIgnoreCase(scheme) || "tel".equalsIgnoreCase(scheme);
        } catch (URISyntaxException | NullPointerException error) {
            return false;
        }
    }
}
