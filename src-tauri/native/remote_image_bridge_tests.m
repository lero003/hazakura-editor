// Build separately from the production bridge: injected protocols and shortened
// deadlines are confined to this acceptance-test translation unit.
#define HZ_REMOTE_IMAGE_TESTING 1
#include "remote_image_bridge.m"
#include <stdio.h>

static NSUInteger requests;
static NSURLRequest *lastRequest;
static NSUInteger checks;
static NSData *png(void) {
    const uint8_t bytes[] = {0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};
    return [NSData dataWithBytes:bytes length:sizeof(bytes)];
}
static void check(BOOL condition, const char *label) {
    checks++;
    if (!condition) { fprintf(stderr, "FAIL: %s\n", label); exit(1); }
}

@interface HZFixtureProtocol : NSURLProtocol
@property(nonatomic) BOOL stopped;
@end
@implementation HZFixtureProtocol
+ (BOOL)canInitWithRequest:(NSURLRequest *)request { (void)request; return YES; }
+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request { return request; }
- (void)emit:(dispatch_block_t)block after:(NSTimeInterval)delay {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)),
                   dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0), ^{
        @synchronized(self) { if (!self.stopped) block(); }
    });
}
- (void)startLoading {
    @synchronized(HZFixtureProtocol.class) { requests++; lastRequest = self.request; }
    [self emit:^{ [self sendFixture]; } after:0.001];
}
- (void)sendFixture {
    NSString *path = self.request.URL.path;
    if ([path isEqualToString:@"/header-timeout"]) return;
    NSMutableDictionary *headers = [@{@"Content-Type": @"image/png"} mutableCopy];
    NSInteger status = 200;
    NSURL *responseURL = self.request.URL;
    if ([path isEqualToString:@"/redirect"]) { status = 302; headers[@"Location"] = @"http://never-follow.invalid/"; }
    if ([path isEqualToString:@"/status"]) status = 404;
    if ([path isEqualToString:@"/mime"]) headers[@"Content-Type"] = @"text/html";
    if ([path isEqualToString:@"/octet"]) headers[@"Content-Type"] = @"APPLICATION/OCTET-STREAM";
    if ([path isEqualToString:@"/no-mime"]) [headers removeObjectForKey:@"Content-Type"];
    if ([path isEqualToString:@"/declared-limit"]) headers[@"Content-Length"] = @"1000";
    if ([path isEqualToString:@"/cookies"]) headers[@"Set-Cookie"] = @"secret=image-session; Secure";
    if ([path isEqualToString:@"/final-http"]) responseURL = [NSURL URLWithString:@"http://fixture.invalid/image"];
    if ([path isEqualToString:@"/network-error"]) {
        [self.client URLProtocol:self didFailWithError:[NSError errorWithDomain:NSURLErrorDomain code:NSURLErrorCannotConnectToHost userInfo:nil]];
        return;
    }
    NSHTTPURLResponse *response = [[NSHTTPURLResponse alloc] initWithURL:responseURL statusCode:status HTTPVersion:@"HTTP/1.1" headerFields:headers];
    [self.client URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    if ([path isEqualToString:@"/idle-timeout"]) {
        [self.client URLProtocol:self didLoadData:[NSMutableData dataWithLength:1024]];
        return;
    }
    if ([path isEqualToString:@"/global-timeout"]) {
        [self.client URLProtocol:self didLoadData:[NSMutableData dataWithLength:1024]];
        for (NSUInteger i = 0; i < 20; i++) {
            [self emit:^{ [self.client URLProtocol:self didLoadData:[NSData dataWithBytes:"x" length:1]]; } after:0.04 * (i + 1)];
        }
        return;
    }
    if ([path isEqualToString:@"/chunk-limit"]) {
        [self.client URLProtocol:self didLoadData:png()];
        [self.client URLProtocol:self didLoadData:png()];
    } else if (![path isEqualToString:@"/empty"]) {
        [self.client URLProtocol:self didLoadData:png()];
    }
    [self.client URLProtocolDidFinishLoading:self];
}
- (void)stopLoading { @synchronized(self) { self.stopped = YES; } }
@end

static HZRemoteImageResult run(NSString *path, size_t limit) {
    HZRemoteImageResult result;
    NSString *url = [@"https://fixture.invalid" stringByAppendingString:path];
    hz_remote_image_fetch(url.UTF8String, limit, &result);
    return result;
}
static void failure(NSString *path, size_t limit, const char *message) {
    HZRemoteImageResult result = run(path, limit);
    if (!result.error || !strstr(result.error, message)) fprintf(stderr, "Unexpected error %s: %s\n", path.UTF8String, result.error ?: "<none>");
    check(result.error && strstr(result.error, message), path.UTF8String);
    check(!result.bytes && !result.length, "failure never exposes a partial body");
    hz_remote_image_result_free(&result);
}

int main(void) {
    @autoreleasepool {
        hz_test_protocol_class = HZFixtureProtocol.class;
        HZRemoteImageResult result = run(@"/png", 8);
        check(!result.error && result.status == 200 && result.length == 8 &&
              !memcmp(result.bytes, png().bytes, 8), "exact-limit PNG body succeeds");
        check(!strcmp(result.content_type, "image/png") && !strcmp(result.final_url, "https://fixture.invalid/png"), "HTTP metadata is copied");
        check([[lastRequest valueForHTTPHeaderField:@"User-Agent"] isEqualToString:@"HazakuraEditor/1.13 (local preview image fetch)"], "existing User-Agent");
        check([[lastRequest valueForHTTPHeaderField:@"Accept"] isEqualToString:@"image/png,image/jpeg,image/gif,image/webp,image/*;q=0.8"], "existing image Accept");
        check(!lastRequest.HTTPShouldHandleCookies, "request disables cookies");
        check(!hz_test_last_configuration.URLCache && !hz_test_last_configuration.HTTPCookieStorage &&
              !hz_test_last_configuration.URLCredentialStorage && !hz_test_last_configuration.HTTPShouldSetCookies,
              "session has no cache cookie or credential storage");
        check(hz_test_last_configuration.requestCachePolicy == NSURLRequestReloadIgnoringLocalCacheData,
              "cache reads disabled");
        check(hz_test_last_configuration.timeoutIntervalForRequest == MAX(1.0, hz_idle_timeout) &&
              hz_test_last_configuration.timeoutIntervalForResource == hz_global_timeout, "native timeout configuration");
        hz_remote_image_result_free(&result);
        check(!result.bytes && !result.error && !result.content_type && !result.final_url && !result.length && !result.status, "free zeros result");
        hz_remote_image_result_free(&result);
        hz_remote_image_result_free(NULL);

        for (NSString *path in @[@"/octet", @"/no-mime", @"/cookies", @"/empty"]) {
            result = run(path, 8);
            check(!result.error, path.UTF8String);
            hz_remote_image_result_free(&result);
        }
        result = run(@"/png", 8);
        check(![lastRequest valueForHTTPHeaderField:@"Cookie"], "response cookie not carried into next session");
        hz_remote_image_result_free(&result);

        failure(@"/chunk-limit", 8, "larger");
        failure(@"/declared-limit", 8, "larger");
        NSUInteger before = requests;
        failure(@"/redirect", 8, "redirects are not followed");
        check(requests == before + 1, "redirect never starts a second request");
        failure(@"/status", 8, "HTTP 404");
        failure(@"/mime", 8, "not an image");
        failure(@"/final-http", 8, "away from https");
        failure(@"/network-error", 8, "fetch failed");
        failure(@"/header-timeout", 8, "header timeout");
        failure(@"/idle-timeout", 2048, "idle timeout");
        NSTimeInterval start = NSProcessInfo.processInfo.systemUptime;
        failure(@"/global-timeout", 2048, "total timeout");
        check(NSProcessInfo.processInfo.systemUptime - start < 0.7, "streaming bytes cannot extend global timeout");


        before = requests;
        const char invalidUTF8[] = {(char)0xff, 0};
        const char *invalid[] = {NULL, "", "http://fixture.invalid/png", "https:///png", "https://user:secret@fixture.invalid/png", "https://fixture.invalid/a@b", "https://fixture.invalid/\nimage", invalidUTF8};
        for (NSUInteger i = 0; i < sizeof(invalid) / sizeof(invalid[0]); i++) {
            hz_remote_image_fetch(invalid[i], 8, &result);
            check(result.error != NULL, "invalid URL rejected before session");
            hz_remote_image_result_free(&result);
        }
        result = run(@"/png", 0);
        check(result.error != NULL && requests == before, "zero limit and invalid URLs do not make requests");
        hz_remote_image_result_free(&result);
        hz_remote_image_fetch("https://fixture.invalid/png", 8, NULL);

        for (NSUInteger stage = 1; stage <= 2; stage++) {
            hz_test_exception_stage = stage;
            failure(@"/png", 8, "native transport");
        }
        hz_test_exception_stage = 0;


        // Exercise delegate callbacks directly: a URLProtocol fixture cannot
        // emulate OS TLS evaluation or guarantee callbacks after cancellation.
        NSURLSession *dummySession = [NSURLSession sessionWithConfiguration:NSURLSessionConfiguration.ephemeralSessionConfiguration];
        NSURLSessionDataTask *dummyTask = [dummySession dataTaskWithURL:[NSURL URLWithString:@"https://fixture.invalid/unused"]];
        HZRemoteImageFetch *fetch = [HZRemoteImageFetch new];
        fetch.data = [NSMutableData data]; fetch.limit = 8;
        fetch.semaphore = dispatch_semaphore_create(0);
        NSHTTPURLResponse *redirect = [[NSHTTPURLResponse alloc] initWithURL:[NSURL URLWithString:@"https://fixture.invalid/png"] statusCode:301 HTTPVersion:@"HTTP/1.1" headerFields:@{}];
        __block BOOL didRefuse = NO;
        [fetch URLSession:dummySession task:dummyTask willPerformHTTPRedirection:redirect newRequest:lastRequest completionHandler:^(NSURLRequest *request) { didRefuse = !request; }];
        check(didRefuse && fetch.completed && fetch.status == 301, "redirect delegate always refuses new request");
        [fetch URLSession:dummySession dataTask:dummyTask didReceiveData:png()];
        [fetch URLSession:dummySession task:dummyTask didCompleteWithError:nil];
        check(fetch.data.length == 0 && fetch.error != nil, "late body and completion cannot revive cancelled state");
        __block NSURLSessionResponseDisposition responseDisposition = NSURLSessionResponseAllow;
        [fetch URLSession:dummySession dataTask:dummyTask didReceiveResponse:redirect completionHandler:^(NSURLSessionResponseDisposition disposition) { responseDisposition = disposition; }];
        check(responseDisposition == NSURLSessionResponseCancel, "late response is cancelled");

        for (NSString *method in @[NSURLAuthenticationMethodHTTPBasic, NSURLAuthenticationMethodClientCertificate, NSURLAuthenticationMethodServerTrust]) {
            fetch = [HZRemoteImageFetch new]; fetch.data = [NSMutableData data]; fetch.semaphore = dispatch_semaphore_create(0);
            NSURLProtectionSpace *space = [[NSURLProtectionSpace alloc] initWithHost:@"fixture.invalid" port:443 protocol:@"https" realm:nil authenticationMethod:method];
            NSURLAuthenticationChallenge *challenge = [[NSURLAuthenticationChallenge alloc] initWithProtectionSpace:space proposedCredential:nil previousFailureCount:0 failureResponse:nil error:nil sender:(id<NSURLAuthenticationChallengeSender>)[NSObject new]];
            __block NSURLSessionAuthChallengeDisposition disposition = NSURLSessionAuthChallengeUseCredential;
            __block BOOL suppliedCredential = YES;
            [fetch handleChallenge:challenge completionHandler:^(NSURLSessionAuthChallengeDisposition value, NSURLCredential *credential) { disposition = value; suppliedCredential = credential != nil; }];
            check(!suppliedCredential && disposition == ([method isEqualToString:NSURLAuthenticationMethodServerTrust] ? NSURLSessionAuthChallengePerformDefaultHandling : NSURLSessionAuthChallengeCancelAuthenticationChallenge), "authentication refusal and default OS server trust");
        }
        [dummySession invalidateAndCancel];
        printf("PASS: %lu native remote-image acceptance checks\n", (unsigned long)checks);
    }
    return 0;
}
