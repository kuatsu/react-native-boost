#import "TimeToRender.h"
#import "MarkerStore.h"

@implementation TimeToRender
RCT_EXPORT_MODULE()

- (void)startMarker:(NSString *)name time:(double)time {
    [[MarkerStore mainStore] startMarker:name timeSinceStartup:time];
}

- (NSString *)getThermalState {
    switch (NSProcessInfo.processInfo.thermalState) {
        case NSProcessInfoThermalStateNominal:  return @"nominal";
        case NSProcessInfoThermalStateFair:     return @"fair";
        case NSProcessInfoThermalStateSerious:  return @"serious";
        case NSProcessInfoThermalStateCritical: return @"critical";
        default:                                return @"unknown";
    }
}

- (NSString *)getForcedFlags {
    for (NSString *arg in NSProcessInfo.processInfo.arguments) {
        if ([arg hasPrefix:@"--rn-flags="]) return [arg substringFromIndex:[@"--rn-flags=" length]];
    }
    return @"";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeTimeToRenderSpecJSI>(params);
}

@end
