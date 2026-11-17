package com.divzplit.app;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.List;
import java.util.Collections;
public final class DivZplitPackage implements ReactPackage {
 @Override public List<NativeModule> createNativeModules(ReactApplicationContext context){return java.util.Arrays.asList(new DivZplitModule(context),new ReceiptModule(context));}
 @Override public List<ViewManager> createViewManagers(ReactApplicationContext context){return Collections.emptyList();}
}
