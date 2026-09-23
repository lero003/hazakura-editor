#import "background_assets_bridge.m"

@interface HZTestAssetPack : NSObject
@property(nonatomic, copy) NSString *identifier;
@property(nonatomic) NSUInteger version;
@end
@implementation HZTestAssetPack
@end

@interface HZReconnectTestController : HZBackgroundAssetsController
@property(nonatomic) NSUInteger startCount;
@end
@implementation HZReconnectTestController
- (void)startIdentifier:(NSString *)identifier {
    self.startCount += 1;
    NSUInteger generation = [self beginOperationForIdentifier:identifier];
    [self.activeIdentifiers addObject:identifier];
    self.requestedVersions[identifier] = @2;
    [self updateIdentifier:identifier phase:HZPhaseDownloading progress:@0 error:nil version:@2];
    NSCAssert(generation == 1, @"restart must attach one request");
}
@end

static HZTestAssetPack *HZPack(NSString *identifier, NSUInteger version) {
    HZTestAssetPack *pack = [HZTestAssetPack new];
    pack.identifier = identifier;
    pack.version = version;
    return pack;
}

static HZReconnectTestController *HZNewController(void) {
    HZReconnectTestController *controller = [HZReconnectTestController new];
    controller.states = [NSMutableDictionary dictionary];
    controller.operationGenerations = [NSMutableDictionary dictionary];
    controller.activeIdentifiers = [NSMutableSet set];
    controller.requestedVersions = [NSMutableDictionary dictionary];
    controller.confirmedVersions = [NSMutableDictionary dictionary];
    return controller;
}

int main(void) {
    @autoreleasepool {
        NSString *identifier = @"hazakura-coreai-gemma4-12b-v1";
        HZReconnectTestController *controller = HZNewController();

        // A new process receives progress and finish, but has no completion
        // handler from the process that began the download.
        BAAssetPack *latest = (BAAssetPack *)HZPack(identifier, 2);
        NSProgress *progress = [NSProgress progressWithTotalUnitCount:10];
        progress.completedUnitCount = 8;
        [controller downloadOfAssetPack:latest hasProgress:progress];
        [controller downloadOfAssetPackFinished:latest];
        NSCAssert(controller.startCount == 1, @"finish must reattach ensureLocalAvailability");

        // A stale version must not release the new version's wait.
        BAAssetPack *old = (BAAssetPack *)HZPack(identifier, 1);
        [controller downloadOfAssetPack:old hasProgress:progress];
        [controller downloadOfAssetPackFinished:old];
        NSMutableDictionary *state = [controller stateForIdentifier:identifier];
        NSCAssert([state[@"phase"] isEqual:HZPhaseDownloading], @"old finish cannot mark ready");
        NSCAssert([state[@"assetPackVersion"] isEqual:@2], @"old finish cannot change version");
        NSCAssert([state[@"progress"] isEqual:@0], @"old finish cannot complete progress");

        [controller downloadOfAssetPackFinished:latest];
        NSCAssert([state[@"phase"] isEqual:HZPhaseDownloading], @"delegate finish must await ensure completion");
        NSCAssert([state[@"progress"] isEqual:@1], @"current finish may report progress");
        [controller completeEnsureForIdentifier:identifier generation:1 version:@2 error:nil];
        NSCAssert([state[@"phase"] isEqual:@"downloaded"], @"reconnected ensure completion must release verification");
        NSCAssert([state[@"assetPackVersion"] isEqual:@2], @"ready version must be current");
        [controller downloadOfAssetPackFinished:latest];
        NSCAssert(controller.startCount == 1, @"duplicate finish cannot restart a confirmed version");

        HZReconnectTestController *finishOnly = HZNewController();
        [finishOnly downloadOfAssetPackFinished:latest];
        NSCAssert(finishOnly.startCount == 1, @"finish without progress must also reattach");
    }
    return 0;
}
