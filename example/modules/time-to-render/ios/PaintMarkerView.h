#import <UIKit/UIKit.h>
#import <React/RCTView.h>

NS_ASSUME_NONNULL_BEGIN

@interface PaintMarkerView : UIView

@property (nonatomic, retain) NSString *markerName;
@property (nonatomic, copy) RCTDirectEventBlock onMarkerPainted;

@end

NS_ASSUME_NONNULL_END
