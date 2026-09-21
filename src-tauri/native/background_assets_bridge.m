#import <BackgroundAssets/BackgroundAssets.h>
#import <CommonCrypto/CommonDigest.h>
#import <Foundation/Foundation.h>

static NSString *const HZPhaseNotDownloaded = @"not_downloaded";
static NSString *const HZPhaseDownloading = @"downloading";
static NSString *const HZPhasePaused = @"paused";
static NSString *const HZPhaseFailed = @"failed";

@interface HZBackgroundAssetsController : NSObject <BAManagedAssetPackDownloadDelegate>
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary *> *states;
@end

@implementation HZBackgroundAssetsController

+ (instancetype)shared {
    static HZBackgroundAssetsController *controller;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
      controller = [[HZBackgroundAssetsController alloc] init];
      controller.states = [NSMutableDictionary dictionary];
    });
    return controller;
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

- (NSDictionary *)snapshotForIdentifier:(NSString *)identifier relativePath:(NSString *)relativePath {
#if __MAC_OS_X_VERSION_MAX_ALLOWED >= 270000
    if (@available(macOS 27, *)) {
        BAAssetPackManager *manager = BAAssetPackManager.sharedManager;
        manager.delegate = self;
        BOOL available = [manager assetPackIsAvailableLocallyWithIdentifier:identifier];
        NSMutableDictionary *result;
        @synchronized(self) {
            result = [[self stateForIdentifier:identifier] mutableCopy];
        }
        result[@"supported"] = @YES;
        result[@"available"] = @(available);
        result[@"path"] = [NSNull null];
        if (!available && [result[@"phase"] isEqual:HZPhaseNotDownloaded]) {
            NSError *downloadsError = nil;
            NSArray<BADownload *> *downloads = [BADownloadManager.sharedManager fetchCurrentDownloads:&downloadsError];
            for (BADownload *download in downloads ?: @[]) {
                if ([download.identifier isEqualToString:identifier]) {
                    result[@"phase"] = download.state == BADownloadStateFailed
                        ? HZPhaseFailed
                        : HZPhaseDownloading;
                    break;
                }
            }
            if (downloadsError != nil) {
                result[@"error"] = downloadsError.localizedDescription;
            }
        }
        if (available) {
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
        BAAssetPackManager *manager = BAAssetPackManager.sharedManager;
        manager.delegate = self;
        [self updateIdentifier:identifier phase:@"resolving" progress:nil error:nil version:nil];
        [manager getManifestWithCompletionHandler:^(BAAssetPackManifest *_Nullable manifest, NSError *_Nullable error) {
          if (error != nil || manifest == nil) {
              [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                               error:error.localizedDescription ?: @"Apple-hosted asset manifest is unavailable."
                             version:nil];
              return;
          }
          BAAssetPack *assetPack = [manifest assetPackWithIdentifier:identifier];
          if (assetPack == nil) {
              [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                               error:@"The requested Core AI asset pack is not present in the processed Apple-hosted manifest."
                             version:nil];
              return;
          }
          [self updateIdentifier:identifier phase:HZPhaseDownloading progress:@0
                           error:nil version:@(assetPack.version)];
          [manager ensureLocalAvailabilityOfAssetPack:assetPack
                                 requireLatestVersion:YES
                                    completionHandler:^(NSError *_Nullable downloadError) {
            if (downloadError != nil) {
                [self updateIdentifier:identifier phase:HZPhaseFailed progress:nil
                                 error:downloadError.localizedDescription version:@(assetPack.version)];
            } else {
                [self updateIdentifier:identifier phase:@"downloaded" progress:@1
                                 error:nil version:@(assetPack.version)];
            }
          }];
        }];
        return;
    }
#endif
    [self updateIdentifier:identifier phase:@"unsupported" progress:nil
                     error:@"Core AI managed models require macOS 27 or later." version:nil];
}

- (BOOL)cancelIdentifier:(NSString *)identifier error:(NSError **)error {
    NSArray<BADownload *> *downloads = [BADownloadManager.sharedManager fetchCurrentDownloads:error];
    if (downloads == nil) {
        return NO;
    }
    for (BADownload *download in downloads) {
        if ([download.identifier isEqualToString:identifier]) {
            BOOL cancelled = [BADownloadManager.sharedManager cancelDownload:download error:error];
            if (cancelled) {
                [self updateIdentifier:identifier phase:HZPhasePaused progress:nil error:nil version:nil];
            }
            return cancelled;
        }
    }
    return NO;
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
    [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading progress:@0 error:nil version:@(assetPack.version)];
}

- (void)downloadOfAssetPackPaused:(BAAssetPack *)assetPack {
    [self updateIdentifier:assetPack.identifier phase:HZPhasePaused progress:nil error:nil version:@(assetPack.version)];
}

- (void)downloadOfAssetPack:(BAAssetPack *)assetPack hasProgress:(NSProgress *)progress {
    [self updateIdentifier:assetPack.identifier phase:HZPhaseDownloading
                   progress:@(progress.fractionCompleted) error:nil version:@(assetPack.version)];
}

- (void)downloadOfAssetPackFinished:(BAAssetPack *)assetPack {
    [self updateIdentifier:assetPack.identifier phase:@"downloaded" progress:@1 error:nil version:@(assetPack.version)];
}

- (void)downloadOfAssetPack:(BAAssetPack *)assetPack failedWithError:(NSError *)error {
    [self updateIdentifier:assetPack.identifier phase:HZPhaseFailed progress:nil
                     error:error.localizedDescription version:@(assetPack.version)];
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
