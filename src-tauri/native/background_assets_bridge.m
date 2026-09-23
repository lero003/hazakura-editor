#import <BackgroundAssets/BackgroundAssets.h>
#import <CommonCrypto/CommonDigest.h>
#import <Foundation/Foundation.h>

static NSString *const HZPhaseNotDownloaded = @"not_downloaded";
static NSString *const HZPhaseDownloading = @"downloading";
static NSString *const HZPhasePaused = @"paused";
static NSString *const HZPhaseFailed = @"failed";

@interface HZBackgroundAssetsController : NSObject <BAManagedAssetPackDownloadDelegate>
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary *> *states;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *operationGenerations;
@property(nonatomic, strong) NSMutableSet<NSString *> *activeIdentifiers;
@property(nonatomic, strong) NSMutableSet<NSString *> *explicitlyStoppedIdentifiers;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *requestedVersions;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *confirmedVersions;
@property(nonatomic, strong) dispatch_queue_t operationQueue;
- (void)completeEnsureForIdentifier:(NSString *)identifier
                         generation:(NSUInteger)generation
                            version:(NSNumber *)version
                              error:(NSError *_Nullable)error;
@end

@implementation HZBackgroundAssetsController

+ (instancetype)shared {
    static HZBackgroundAssetsController *controller;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
      controller = [[HZBackgroundAssetsController alloc] init];
      controller.states = [NSMutableDictionary dictionary];
      controller.operationGenerations = [NSMutableDictionary dictionary];
      controller.activeIdentifiers = [NSMutableSet set];
      controller.explicitlyStoppedIdentifiers = [NSMutableSet set];
      controller.requestedVersions = [NSMutableDictionary dictionary];
      controller.confirmedVersions = [NSMutableDictionary dictionary];
      controller.operationQueue = dispatch_queue_create("dev.hazakura.editor.background-assets", DISPATCH_QUEUE_SERIAL);
    });
    return controller;
}

- (NSUInteger)beginOperationForIdentifier:(NSString *)identifier {
    @synchronized(self) {
        NSUInteger generation = [self.operationGenerations[identifier] unsignedIntegerValue] + 1;
        self.operationGenerations[identifier] = @(generation);
        return generation;
    }
}

- (void)invalidateOperationForIdentifier:(NSString *)identifier {
    (void)[self beginOperationForIdentifier:identifier];
}

- (NSUInteger)beginStartForIdentifier:(NSString *)identifier {
    @synchronized(self) {
        NSUInteger generation = [self beginOperationForIdentifier:identifier];
        [self.explicitlyStoppedIdentifiers removeObject:identifier];
        [self.activeIdentifiers addObject:identifier];
        [self.requestedVersions removeObjectForKey:identifier];
        [self updateIdentifier:identifier phase:@"resolving" progress:nil error:nil version:nil];
        return generation;
    }
}

- (void)beginExplicitCancellationForIdentifier:(NSString *)identifier {
    @synchronized(self) {
        [self invalidateOperationForIdentifier:identifier];
        [self.activeIdentifiers removeObject:identifier];
        [self.requestedVersions removeObjectForKey:identifier];
        [self.explicitlyStoppedIdentifiers addObject:identifier];
        [self updateIdentifier:identifier phase:HZPhasePaused progress:nil error:nil version:nil];
    }
}

- (BOOL)isCurrentOperationForIdentifier:(NSString *)identifier generation:(NSUInteger)generation {
    @synchronized(self) {
        return [self.operationGenerations[identifier] unsignedIntegerValue] == generation;
    }
}

- (NSMutableDictionary *)stateForIdentifier:(NSString *)identifier {
    @synchronized(self) {
        NSMutableDictionary *state = self.states[identifier];
        if (state == nil) {
            state = [@{
                @"phase" : HZPhaseNotDownloaded,
                @"progress" : [NSNull null],
                @"error" : [NSNull null],
                @"assetPackVersion" : [NSNull null],
            } mutableCopy];
            self.states[identifier] = state;
        }
        return state;
    }
}

- (void)updateIdentifier:(NSString *)identifier
                    phase:(NSString *)phase
                 progress:(NSNumber *_Nullable)progress
                    error:(NSString *_Nullable)error
                  version:(NSNumber *_Nullable)version {
    @synchronized(self) {
        NSMutableDictionary *state = [self stateForIdentifier:identifier];
        state[@"phase"] = phase;
        state[@"progress"] = progress ?: [NSNull null];
        state[@"error"] = error ?: [NSNull null];
        if (version != nil) {
            state[@"assetPackVersion"] = version;
        }
    }
}

- (BOOL)acceptsDelegateAssetPack:(BAAssetPack *)assetPack {
    @synchronized(self) {
        NSString *identifier = assetPack.identifier;
        NSNumber *eventVersion = @(assetPack.version);
        NSNumber *requested = self.requestedVersions[identifier];
        if (requested != nil && ![requested isEqualToNumber:eventVersion]) return NO;
        NSNumber *confirmed = self.confirmedVersions[identifier];
        if (confirmed != nil && assetPack.version < confirmed.unsignedIntegerValue) return NO;
        // A delegate-observed pause may resume without another user action.
        // Only an explicit cancellation must reject delayed callbacks.
        if ([self.explicitlyStoppedIdentifiers containsObject:identifier]) return NO;
        NSString *phase = [self stateForIdentifier:identifier][@"phase"];
        if (![self.activeIdentifiers containsObject:identifier]) {
            if ([phase isEqual:HZPhaseFailed]) return NO;
            if ([phase isEqual:@"downloaded"] && [confirmed isEqualToNumber:eventVersion]) return NO;
        }
        return YES;
    }
}

- (BOOL)reattachIfDownloadingIdentifier:(NSString *)identifier {
    @synchronized(self) {
        NSString *phase = [self stateForIdentifier:identifier][@"phase"];
        if (![phase isEqual:HZPhaseDownloading] || [self.activeIdentifiers containsObject:identifier]
            || [self.explicitlyStoppedIdentifiers containsObject:identifier]) return NO;
        // A delegate notification from an earlier process has no completion
        // handler here. Bind a new ensure request to the current manifest.
        [self startIdentifier:identifier];
        return YES;
    }
}

- (void)completeEnsureForIdentifier:(NSString *)identifier
                         generation:(NSUInteger)generation
                            version:(NSNumber *)version
                              error:(NSError *_Nullable)error {
    @synchronized(self) {
        if (![self isCurrentOperationForIdentifier:identifier generation:generation]) return;
        [self.activeIdentifiers removeObject:identifier];
        [self.requestedVersions removeObjectForKey:identifier];
        if (error != nil) {
            [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                             error:error.localizedDescription version:version];
        } else {
            self.confirmedVersions[identifier] = version;
            [self updateIdentifier:identifier phase:@"downloaded" progress:@1 error:nil version:version];
        }
    }
}

- (NSDictionary *)snapshotForIdentifier:(NSString *)identifier relativePath:(NSString *)relativePath {
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 270000
    if (@available(macOS 27, *)) {
        BAAssetPackManager *manager = BAAssetPackManager.sharedManager;
        manager.delegate = self;
        BOOL inspectDownloads;
        @synchronized(self) {
            inspectDownloads = [[self stateForIdentifier:identifier][@"phase"] isEqual:HZPhaseNotDownloaded]
                && ![self.explicitlyStoppedIdentifiers containsObject:identifier];
        }
        if (inspectDownloads) {
            // An old version can remain available during a new download.
            // Inspect active downloads even when the pack ID is locally present.
            NSError *downloadsError = nil;
            NSArray<BADownload *> *downloads = [BADownloadManager.sharedManager fetchCurrentDownloads:&downloadsError];
            for (BADownload *download in downloads ?: @[]) {
                if ([download.identifier isEqualToString:identifier]) {
                    @synchronized(self) {
                        if ([[self stateForIdentifier:identifier][@"phase"] isEqual:HZPhaseNotDownloaded]
                            && ![self.explicitlyStoppedIdentifiers containsObject:identifier]) {
                            [self updateIdentifier:identifier
                                            phase:download.state == BADownloadStateFailed ? HZPhaseFailed : HZPhaseDownloading
                                         progress:nil error:nil version:nil];
                        }
                    }
                    break;
                }
            }
            if (downloadsError != nil) {
                @synchronized(self) {
                    [self stateForIdentifier:identifier][@"error"] = downloadsError.localizedDescription;
                }
            }
        }
        [self reattachIfDownloadingIdentifier:identifier];
        NSMutableDictionary *result;
        @synchronized(self) {
            result = [[self stateForIdentifier:identifier] mutableCopy];
        }
        BOOL available = [manager assetPackIsAvailableLocallyWithIdentifier:identifier];
        result[@"supported"] = @YES;
        result[@"available"] = @(available);
        result[@"path"] = [NSNull null];
        // An older version may still be locally available while an update is
        // resolving or downloading. Keep the operation phase so the Rust
        // monitor cannot verify the old path as if it were the requested one.
        NSString *phase = result[@"phase"];
        BOOL canResolvePath = [phase isEqualToString:HZPhaseNotDownloaded]
            || [phase isEqualToString:@"downloaded"];
        if (available && canResolvePath) {
            NSError *error = nil;
            NSURL *URL = [manager URLForPath:relativePath error:&error];
            BOOL isDirectory = NO;
            if (URL != nil && [[NSFileManager defaultManager] fileExistsAtPath:URL.path isDirectory:&isDirectory] && isDirectory) {
                result[@"path"] = URL.path;
                result[@"phase"] = @"downloaded";
                result[@"progress"] = @1.0;
                result[@"error"] = [NSNull null];
            } else {
                result[@"phase"] = HZPhaseFailed;
                result[@"error"] = error.localizedDescription ?: @"The downloaded asset pack did not contain the expected model directory.";
            }
        }
        return result;
    }
#endif
    return @{
        @"supported" : @NO,
        @"available" : @NO,
        @"phase" : @"unsupported",
        @"progress" : [NSNull null],
        @"path" : [NSNull null],
        @"error" : @"Core AI managed models require macOS 27 or later.",
        @"assetPackVersion" : [NSNull null],
    };
}

- (void)startIdentifier:(NSString *)identifier {
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 270000
    if (@available(macOS 27, *)) {
        // The monitor starts immediately after this method returns. Publish
        // resolving and invalidate an earlier request before queueing the
        // asynchronous manifest request.
        NSUInteger generation = [self beginStartForIdentifier:identifier];
        dispatch_async(self.operationQueue, ^{
          BAAssetPackManager *manager = BAAssetPackManager.sharedManager;
          manager.delegate = self;
          [manager getManifestWithCompletionHandler:^(BAAssetPackManifest *_Nullable manifest, NSError *_Nullable error) {
            dispatch_async(self.operationQueue, ^{
              if (![self isCurrentOperationForIdentifier:identifier generation:generation]) return;
              if (error != nil || manifest == nil) {
                  @synchronized(self) {
                      [self.activeIdentifiers removeObject:identifier];
                      [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                                       error:error.localizedDescription ?: @"Apple-hosted asset manifest is unavailable."
                                     version:nil];
                  }
                  return;
              }
              BAAssetPack *assetPack = [manifest assetPackWithIdentifier:identifier];
              if (assetPack == nil) {
                  @synchronized(self) {
                      [self.activeIdentifiers removeObject:identifier];
                      [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                                       error:@"The requested Core AI asset pack is not present in the processed Apple-hosted manifest."
                                     version:nil];
                  }
                  return;
              }
              if (![self isCurrentOperationForIdentifier:identifier generation:generation]) return;
              @synchronized(self) {
                  self.requestedVersions[identifier] = @(assetPack.version);
                  [self updateIdentifier:identifier phase:HZPhaseDownloading progress:@0
                                   error:nil version:@(assetPack.version)];
              }
              [manager ensureLocalAvailabilityOfAssetPack:assetPack
                                     requireLatestVersion:YES
                                        completionHandler:^(NSError *_Nullable downloadError) {
                dispatch_async(self.operationQueue, ^{
                  [self completeEnsureForIdentifier:identifier generation:generation
                                            version:@(assetPack.version) error:downloadError];
                });
              }];
            });
          }];
        });
        return;
    }
#endif
    [self updateIdentifier:identifier phase:@"unsupported" progress:nil
                     error:@"Core AI managed models require macOS 27 or later." version:nil];
}

- (BOOL)cancelIdentifier:(NSString *)identifier error:(NSError **)error {
    __block BOOL accepted = YES;
    __block NSError *operationError = nil;
    dispatch_sync(self.operationQueue, ^{
      [self beginExplicitCancellationForIdentifier:identifier];
      NSArray<BADownload *> *downloads = [BADownloadManager.sharedManager fetchCurrentDownloads:&operationError];
      if (downloads == nil) {
          accepted = NO;
          @synchronized(self) {
              [self.explicitlyStoppedIdentifiers removeObject:identifier];
              [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                               error:operationError.localizedDescription version:nil];
          }
          return;
      }
      for (BADownload *download in downloads) {
          if ([download.identifier isEqualToString:identifier]) {
              accepted = [BADownloadManager.sharedManager cancelDownload:download error:&operationError];
              if (!accepted) {
                  @synchronized(self) {
                      [self.explicitlyStoppedIdentifiers removeObject:identifier];
                      [self updateIdentifier:identifier phase:HZPhaseDownloading progress:nil
                                       error:operationError.localizedDescription version:nil];
                  }
              }
              return;
          }
      }
      // No BADownload exists while the manifest is resolving. Invalidating its
      // generation is the successful logical cancellation in that state.
    });
    if (!accepted && error != NULL) *error = operationError;
    return accepted;
}

- (BOOL)removeIdentifier:(NSString *)identifier error:(NSError **)error {
    if (@available(macOS 26, *)) {
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        __block NSError *removeError = nil;
        [BAAssetPackManager.sharedManager removeAssetPackWithIdentifier:identifier
                                                     completionHandler:^(NSError *_Nullable completionError) {
          removeError = completionError;
          dispatch_semaphore_signal(semaphore);
        }];
        if (dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC)) != 0) {
            if (error != NULL) {
                *error = [NSError errorWithDomain:@"dev.hazakura.editor.background-assets"
                                              code:1
                                          userInfo:@{NSLocalizedDescriptionKey : @"Timed out while removing the asset pack."}];
            }
            return NO;
        }
        if (removeError != nil) {
            if (error != NULL) *error = removeError;
            return NO;
        }
        @synchronized(self) {
            [self invalidateOperationForIdentifier:identifier];
            [self.activeIdentifiers removeObject:identifier];
            // A removed pack must also ignore callbacks already in flight.
            [self.explicitlyStoppedIdentifiers addObject:identifier];
            [self.requestedVersions removeObjectForKey:identifier];
            [self.confirmedVersions removeObjectForKey:identifier];
            [self.states removeObjectForKey:identifier];
        }
        return YES;
    }
    if (error != NULL) {
        *error = [NSError errorWithDomain:@"dev.hazakura.editor.background-assets"
                                      code:2
                                  userInfo:@{NSLocalizedDescriptionKey : @"Managed asset packs require macOS 26 or later."}];
    }
    return NO;
}

- (void)downloadOfAssetPackBegan:(BAAssetPack *)assetPack {
    @synchronized(self) {
        if (![self acceptsDelegateAssetPack:assetPack]) return;
        [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading progress:@0 error:nil version:@(assetPack.version)];
    }
}

- (void)downloadOfAssetPackPaused:(BAAssetPack *)assetPack {
    @synchronized(self) {
        if (![self acceptsDelegateAssetPack:assetPack]) return;
        [self updateIdentifier:assetPack.identifier phase:HZPhasePaused progress:nil error:nil version:@(assetPack.version)];
    }
}

- (void)downloadOfAssetPack:(BAAssetPack *)assetPack hasProgress:(NSProgress *)progress {
    @synchronized(self) {
        if (![self acceptsDelegateAssetPack:assetPack]) return;
        [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading
                       progress:@(progress.fractionCompleted) error:nil version:@(assetPack.version)];
    }
}

- (void)downloadOfAssetPackFinished:(BAAssetPack *)assetPack {
    @synchronized(self) {
        if (![self acceptsDelegateAssetPack:assetPack]) return;
        NSString *phase = [self stateForIdentifier:assetPack.identifier][@"phase"];
        if ([phase isEqualToString:HZPhaseDownloading] || [phase isEqualToString:HZPhaseNotDownloaded]
            || [phase isEqualToString:HZPhasePaused]) {
            if (![phase isEqualToString:HZPhaseDownloading]) {
                [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading
                             progress:@1 error:nil version:@(assetPack.version)];
            }
            if ([self reattachIfDownloadingIdentifier:assetPack.identifier]) return;
            // Delegate finish can precede this process's ensure completion.
            [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading
                         progress:@1 error:nil version:@(assetPack.version)];
        }
    }
}

- (void)downloadOfAssetPack:(BAAssetPack *)assetPack failedWithError:(NSError *)error {
    @synchronized(self) {
        if (![self acceptsDelegateAssetPack:assetPack]) return;
        [self updateIdentifier:assetPack.identifier phase:HZPhaseFailed progress:nil
                         error:error.localizedDescription version:@(assetPack.version)];
    }
}

@end

static char *HZCopyJSON(id value) {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:&error];
    if (data == nil) {
        value = @{ @"error" : error.localizedDescription ?: @"Failed to encode Background Assets response." };
        data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    }
    NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return strdup(text.UTF8String);
}

char *hazakura_ba_snapshot(const char *assetPackID, const char *relativePath) {
    @autoreleasepool {
        NSString *identifier = [NSString stringWithUTF8String:assetPackID ?: ""];
        NSString *path = [NSString stringWithUTF8String:relativePath ?: ""];
        return HZCopyJSON([[HZBackgroundAssetsController shared] snapshotForIdentifier:identifier relativePath:path]);
    }
}

char *hazakura_ba_start(const char *assetPackID) {
    @autoreleasepool {
        NSString *identifier = [NSString stringWithUTF8String:assetPackID ?: ""];
        [[HZBackgroundAssetsController shared] startIdentifier:identifier];
        return HZCopyJSON(@{ @"accepted" : @YES });
    }
}

char *hazakura_ba_cancel(const char *assetPackID) {
    @autoreleasepool {
        NSString *identifier = [NSString stringWithUTF8String:assetPackID ?: ""];
        NSError *error = nil;
        BOOL cancelled = [[HZBackgroundAssetsController shared] cancelIdentifier:identifier error:&error];
        return HZCopyJSON(@{
            @"cancelled" : @(cancelled),
            @"error" : error.localizedDescription ?: [NSNull null],
        });
    }
}

char *hazakura_ba_remove(const char *assetPackID) {
    @autoreleasepool {
        NSString *identifier = [NSString stringWithUTF8String:assetPackID ?: ""];
        NSError *error = nil;
        BOOL removed = [[HZBackgroundAssetsController shared] removeIdentifier:identifier error:&error];
        return HZCopyJSON(@{
            @"removed" : @(removed),
            @"error" : error.localizedDescription ?: [NSNull null],
        });
    }
}

char *hazakura_sha256_file(const char *filePath) {
    @autoreleasepool {
        NSString *path = [NSString stringWithUTF8String:filePath ?: ""];
        NSInputStream *stream = [NSInputStream inputStreamWithFileAtPath:path];
        [stream open];
        CC_SHA256_CTX context;
        CC_SHA256_Init(&context);
        uint8_t buffer[1024 * 1024];
        while (true) {
            NSInteger count = [stream read:buffer maxLength:sizeof(buffer)];
            if (count < 0) {
                NSString *message = stream.streamError.localizedDescription ?: @"Failed to read model file.";
                [stream close];
                return strdup([[NSString stringWithFormat:@"ERROR:%@", message] UTF8String]);
            }
            if (count == 0) break;
            CC_SHA256_Update(&context, buffer, (CC_LONG)count);
        }
        [stream close];
        unsigned char digest[CC_SHA256_DIGEST_LENGTH];
        CC_SHA256_Final(digest, &context);
        NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
        for (NSUInteger index = 0; index < CC_SHA256_DIGEST_LENGTH; index++) {
            [hex appendFormat:@"%02x", digest[index]];
        }
        return strdup(hex.UTF8String);
    }
}

void hazakura_free_string(char *value) {
    free(value);
}
