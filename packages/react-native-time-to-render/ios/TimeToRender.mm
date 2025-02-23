#import "TimeToRender.h"
#import "MarkerStore.h"

@implementation TimeToRender
RCT_EXPORT_MODULE()

- (void)startMarker:(NSString *)name time:(double)time {
    [[MarkerStore mainStore] startMarker:name timeSinceStartup:time];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeTimeToRenderSpecJSI>(params);
}

@end
