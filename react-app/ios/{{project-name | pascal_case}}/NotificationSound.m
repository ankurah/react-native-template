#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
@import AudioToolbox;

// Small native module that plays the notification chime.
//
// React Native has no Web Audio API (unlike the web templates), so the JS
// NotificationManager delegates the sound to this module. It's a legacy bridge
// module — which still works under the new architecture via React Native's
// interop layer — and is invoked from JS as NativeModules.NotificationSound.play()
// (see src/notificationSound.ts).
//
// NOTE: this must be a plain Objective-C (.m) file, not Objective-C++ (.mm):
// `@import AudioToolbox;` relies on Clang modules, which are enabled for ObjC
// but disabled for C++, so `@import` fails to compile in a .mm. The @import also
// auto-links AudioToolbox, so no "Link Binary With Libraries" entry is needed.
@interface NotificationSound : NSObject <RCTBridgeModule>
@end

@implementation NotificationSound {
  SystemSoundID _soundID;
  BOOL _triedLoad;
  BOOL _loaded;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (void)ensureLoaded {
  if (_triedLoad) {
    return;
  }
  _triedLoad = YES;
  NSURL *url = [[NSBundle mainBundle] URLForResource:@"notification" withExtension:@"caf"];
  if (url != nil) {
    OSStatus status = AudioServicesCreateSystemSoundID((__bridge CFURLRef)url, &_soundID);
    _loaded = (status == kAudioServicesNoError);
  }
}

RCT_EXPORT_METHOD(play) {
  [self ensureLoaded];
  if (_loaded) {
    AudioServicesPlaySystemSound(_soundID);
  } else {
    // Fall back to a built-in system sound if the bundled file is missing or
    // couldn't be decoded, so a chime still plays.
    AudioServicesPlaySystemSound(1007);
  }
}

@end
