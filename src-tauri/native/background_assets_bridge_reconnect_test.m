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
    [self beginStartForIdentifier:identifier];
    self.requestedVersions[identifier] = @2;
    [self updateIdentifier:identifier phase:HZPhaseDownloading progress:@0 error:nil version:@2];
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
    controller.explicitlyStoppedIdentifiers = [NSMutableSet set];
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

        HZReconnectTestController *pausedFirst = HZNewController();
        [pausedFirst downloadOfAssetPackPaused:latest];
        NSCAssert([[pausedFirst stateForIdentifier:identifier][@"phase"] isEqual:HZPhasePaused],
                  @"a delegate pause must remain visible while the download is paused");
        [pausedFirst downloadOfAssetPack:latest hasProgress:progress];
        [pausedFirst downloadOfAssetPackFinished:latest];
        NSCAssert(pausedFirst.startCount == 1, @"pause then progress must reattach without manual retry");
        [pausedFirst completeEnsureForIdentifier:identifier generation:1 version:@2 error:nil];
        NSCAssert([[pausedFirst stateForIdentifier:identifier][@"phase"] isEqual:@"downloaded"],
                  @"a resumed download must reach downloaded after ensure completes");

        HZReconnectTestController *pausedFinishOnly = HZNewController();
        [pausedFinishOnly downloadOfAssetPackPaused:latest];
        [pausedFinishOnly downloadOfAssetPackFinished:latest];
        NSCAssert(pausedFinishOnly.startCount == 1, @"finish after pause must also reattach");

        HZReconnectTestController *pausedBegan = HZNewController();
        [pausedBegan downloadOfAssetPackPaused:latest];
        [pausedBegan downloadOfAssetPackBegan:latest];
        [pausedBegan downloadOfAssetPackFinished:latest];
        NSCAssert(pausedBegan.startCount == 1, @"begin after pause must reattach");

        HZReconnectTestController *cancelled = HZNewController();
        [cancelled startIdentifier:identifier];
        // This is the same state transition used by cancelIdentifier, without
        // calling the system download manager in the notification-only test.
        [cancelled beginExplicitCancellationForIdentifier:identifier];
        [cancelled downloadOfAssetPackBegan:latest];
        [cancelled downloadOfAssetPack:latest hasProgress:progress];
        [cancelled downloadOfAssetPackFinished:latest];
        [cancelled completeEnsureForIdentifier:identifier generation:1 version:@2 error:nil];
        NSCAssert(cancelled.startCount == 1, @"late notifications must not restart an explicitly cancelled download");
        NSCAssert([[cancelled stateForIdentifier:identifier][@"phase"] isEqual:HZPhasePaused],
                  @"late notifications must leave explicit cancellation visible");
        [cancelled updateIdentifier:identifier phase:HZPhaseDownloading progress:nil error:nil version:nil];
        NSCAssert(![cancelled reattachIfDownloadingIdentifier:identifier],
                  @"a stopped pack must not reattach through the snapshot path");

        [cancelled startIdentifier:identifier];
        NSCAssert(cancelled.startCount == 2, @"explicit retry must start after cancellation");
        [cancelled downloadOfAssetPack:old hasProgress:progress];
        NSCAssert([[cancelled stateForIdentifier:identifier][@"assetPackVersion"] isEqual:@2],
                  @"retry must continue to reject stale pack versions");
        [cancelled downloadOfAssetPack:latest hasProgress:progress];
        NSCAssert([[cancelled stateForIdentifier:identifier][@"progress"] isEqual:@0.8],
                  @"retry must accept the requested version again");
    }
    return 0;
}
