#import "MarkerPaintComponentView.h"
#import "MarkerStore.h"

#import <React/RCTConversions.h>

#import <react/renderer/components/RNTimeToRenderSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNTimeToRenderSpec/EventEmitters.h>
#import <react/renderer/components/RNTimeToRenderSpec/Props.h>
#import <react/renderer/components/RNTimeToRenderSpec/RCTComponentViewHelpers.h>
#import "RCTFabricComponentsPlugins.h"


using namespace facebook::react;

@implementation MarkerPaintComponentView {
  BOOL _alreadyLogged;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<TimeToRenderProps const>();
    _props = defaultProps;
  }

  return self;
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  _alreadyLogged = NO;
}

- (void)didMoveToWindow {
  [super didMoveToWindow];

  if (_alreadyLogged) {
    return;
  }

  if (!self.window) {
    return;
  }

  _alreadyLogged = YES;

  NSString *markerName = RCTNSStringFromString(std::static_pointer_cast<TimeToRenderProps const>(_props)->markerName);

  // However, we cannot do it right now: the views were just mounted but pixels
  // were not drawn on the screen yet.
  // They will be drawn for sure before the next tick of the main run loop.
  // Let's wait for that and then report.
  dispatch_async(dispatch_get_main_queue(), ^{
    NSTimeInterval paintTime = [[MarkerStore mainStore] endMarker:markerName];
    std::dynamic_pointer_cast<TimeToRenderEventEmitter const>(self->_eventEmitter)->onMarkerPainted({.paintTime = paintTime});
  });
}


+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<TimeToRenderComponentDescriptor>();
}

@end

Class<RCTComponentViewProtocol> TimeToRenderCls(void)
{
  return MarkerPaintComponentView.class;
}
