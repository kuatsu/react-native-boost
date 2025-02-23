#import <React/RCTViewManager.h>
#import "TimeToRenderManager.h"
#import "PaintMarkerView.h"

@implementation TimeToRenderManager

RCT_EXPORT_MODULE()

RCT_EXPORT_VIEW_PROPERTY(markerName, NSString)
RCT_EXPORT_VIEW_PROPERTY(onMarkerPainted, RCTDirectEventBlock)

- (UIView *)view
{
  return [[PaintMarkerView alloc] init];
}

@end
