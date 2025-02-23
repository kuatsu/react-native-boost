#import "PaintMarkerView.h"
#import "MarkerStore.h"

@implementation PaintMarkerView {
  BOOL _alreadyLogged;
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

  // However, we cannot do it right now: the views were just mounted but pixels
  // were not drawn on the screen yet.
  // They will be drawn for sure before the next tick of the main run loop.
  // Let's wait for that and then report.
  dispatch_async(dispatch_get_main_queue(), ^{
    NSTimeInterval paintTime = [[MarkerStore mainStore] endMarker:self.markerName];
    self.onMarkerPainted(@{@"paintTime": @(paintTime)});
  });
}

/*
// Only override drawRect: if you perform custom drawing.
// An empty implementation adversely affects performance during animation.
- (void)drawRect:(CGRect)rect {
    // Drawing code
}
*/

@end
