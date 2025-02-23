#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface MarkerStore : NSObject

+ (id)mainStore;
+ (NSTimeInterval)JSTimeIntervalSinceStartup;

- (void)startMarker:(NSString *)marker timeSinceStartup:(NSTimeInterval)time;

- (NSTimeInterval)endMarker:(NSString *)marker;

@end

NS_ASSUME_NONNULL_END
