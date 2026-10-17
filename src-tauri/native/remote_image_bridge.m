#import <Foundation/Foundation.h>
#import "remote_image_bridge.h"
#include <stdlib.h>
#include <string.h>

#ifdef HZ_REMOTE_IMAGE_TESTING
// The test translation unit includes this file. No injection API or timeout
// override exists in the production object file.
static Class hz_test_protocol_class;
static NSURLSessionConfiguration *hz_test_last_configuration;
static NSUInteger hz_test_exception_stage;
static NSTimeInterval hz_header_timeout = 0.12;
static NSTimeInterval hz_idle_timeout = 0.12;
static NSTimeInterval hz_global_timeout = 0.40;
#else
static const NSTimeInterval hz_header_timeout = 12.0;
static const NSTimeInterval hz_idle_timeout = 12.0;
static const NSTimeInterval hz_global_timeout = 32.0;
#endif

@interface HZRemoteImageFetch : NSObject <NSURLSessionDataDelegate>
@property(nonatomic) NSMutableData *data;
@property(nonatomic) NSString *error;
@property(nonatomic) NSString *contentType;
@property(nonatomic) NSString *finalURL;
@property(nonatomic) NSUInteger status;
@property(nonatomic) size_t limit;
@property(nonatomic) BOOL completed;
@property(nonatomic) BOOL receivedResponse;
@property(nonatomic) NSTimeInterval started;
@property(nonatomic) NSTimeInterval lastActivity;
@property(nonatomic) dispatch_semaphore_t semaphore;
@property(nonatomic) dispatch_source_t watchdog;
@property(nonatomic) NSURLSession *session;
@end

@implementation HZRemoteImageFetch
- (void)finish:(NSString *)error {
    @synchronized(self) {
        if (self.completed) return;
        self.completed = YES;
        self.error = error;
        if (error) [self.data setLength:0];
        if (self.watchdog) dispatch_source_cancel(self.watchdog);
        dispatch_semaphore_signal(self.semaphore);
    }
}

- (void)checkDeadline {
    @synchronized(self) {
        if (self.completed) return;
        NSTimeInterval now = NSProcessInfo.processInfo.systemUptime;
        if (now - self.started >= hz_global_timeout) {
            [self finish:@"Remote image fetch exceeded the total timeout."];
        } else if (!self.receivedResponse && now - self.started >= hz_header_timeout) {
            [self finish:@"Remote image response exceeded the header timeout."];
        } else if (self.receivedResponse && now - self.lastActivity >= hz_idle_timeout) {
            [self finish:@"Remote image read exceeded the idle timeout."];
        } else {
            return;
        }
        [self.session invalidateAndCancel];
    }
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task
 didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition))completion {
    (void)session; (void)task;
    @synchronized(self) {
        if (self.completed) { completion(NSURLSessionResponseCancel); return; }
        self.receivedResponse = YES;
        self.lastActivity = NSProcessInfo.processInfo.systemUptime;
        if (![response isKindOfClass:NSHTTPURLResponse.class]) {
            [self finish:@"Remote image response is not HTTP."];
        } else {
            NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
            self.status = (NSUInteger)http.statusCode;
            self.finalURL = http.URL.absoluteString;
            self.contentType = [[http valueForHTTPHeaderField:@"Content-Type"] lowercaseString] ?: @"";
            if (http.statusCode >= 300 && http.statusCode < 400) {
                [self finish:@"Remote image redirects are not followed; use the final https URL."];
            } else if (http.statusCode < 200 || http.statusCode >= 300) {
                [self finish:[NSString stringWithFormat:@"Remote image fetch failed: HTTP %ld.", (long)http.statusCode]];
            } else if (![http.URL.scheme.lowercaseString isEqualToString:@"https"]) {
                [self finish:@"Remote image redirected away from https."];
            } else if (self.contentType.length && ![self.contentType hasPrefix:@"image/"] &&
                       ![self.contentType hasPrefix:@"application/octet-stream"]) {
                [self finish:[NSString stringWithFormat:@"Remote response is not an image (Content-Type: %@).", self.contentType]];
            } else if (response.expectedContentLength >= 0 &&
                       (uint64_t)response.expectedContentLength > (uint64_t)self.limit) {
                [self finish:@"Remote image is larger than the preview limit."];
            }
        }
        completion(self.completed ? NSURLSessionResponseCancel : NSURLSessionResponseAllow);
    }
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task
    didReceiveData:(NSData *)data {
    (void)session;
    @synchronized(self) {
        if (self.completed) return;
        self.lastActivity = NSProcessInfo.processInfo.systemUptime;
        // Subtraction avoids overflow, and bounds the accumulated decoded body.
        if (self.data.length > self.limit || data.length > self.limit - self.data.length) {
            [self finish:@"Remote image is larger than the preview limit."];
            [task cancel];
            return;
        }
        @try {
            [self.data appendData:data];
        } @catch (NSException *exception) {
            (void)exception;
            [self finish:@"Cannot allocate remote image body."];
            [task cancel];
        }
    }
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task
 didCompleteWithError:(NSError *)error {
    (void)session; (void)task;
    @synchronized(self) {
        if (self.completed) return;
        if ([error.domain isEqualToString:NSURLErrorDomain] && error.code == NSURLErrorTimedOut) {
            if (NSProcessInfo.processInfo.systemUptime - self.started >= hz_global_timeout - 0.01)
                [self finish:@"Remote image fetch exceeded the total timeout."];
            else if (self.receivedResponse)
                [self finish:@"Remote image read exceeded the idle timeout."];
            else
                [self finish:@"Remote image response exceeded the header timeout."];
        } else if (error) [self finish:[NSString stringWithFormat:@"Remote image fetch failed: %@", error.localizedDescription]];
        else if (!self.receivedResponse) [self finish:@"Remote image response is missing."];
        else [self finish:nil];
    }
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task
 willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request
 completionHandler:(void (^)(NSURLRequest *))completion {
    (void)session; (void)task; (void)request;
    @synchronized(self) {
        if (!self.completed) {
            self.status = (NSUInteger)response.statusCode;
            self.finalURL = response.URL.absoluteString;
            [self finish:@"Remote image redirects are not followed; use the final https URL."];
        }
        completion(nil);
    }
}

- (void)handleChallenge:(NSURLAuthenticationChallenge *)challenge
 completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completion {
    if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
        // OS trust evaluation only: never install a credential or bypass TLS.
        completion(NSURLSessionAuthChallengePerformDefaultHandling, nil);
    } else {
        [self finish:@"Remote image authentication is not supported."];
        completion(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
    }
}

- (void)URLSession:(NSURLSession *)session didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
 completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completion {
    (void)session;
    [self handleChallenge:challenge completionHandler:completion];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task
 didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
 completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completion {
    (void)session; (void)task;
    [self handleChallenge:challenge completionHandler:completion];
}
@end

static char *hz_copy_string(NSString *value) {
    if (!value) return NULL;
    const char *utf8 = value.UTF8String;
    if (!utf8) return NULL;
    return strdup(utf8);
}

static void hz_result_error(HZRemoteImageResult *result, NSString *error) {
    result->error = hz_copy_string(error);
}

void hz_remote_image_result_free(HZRemoteImageResult *result) {
    if (!result) return;
    free(result->bytes);
    free(result->content_type);
    free(result->final_url);
    free(result->error);
    memset(result, 0, sizeof(*result));
}

void hz_remote_image_fetch(const char *url, size_t limit, HZRemoteImageResult *result) {
    if (!result) return;
    memset(result, 0, sizeof(*result));
    @autoreleasepool {
        HZRemoteImageFetch *fetch = nil;
        @try {
            NSString *text = url ? [NSString stringWithUTF8String:url] : nil;
            NSURLComponents *components = text ? [NSURLComponents componentsWithString:text] : nil;
            NSCharacterSet *invalid = [NSCharacterSet whitespaceAndNewlineCharacterSet];
            if (!text || !text.length || [text rangeOfCharacterFromSet:invalid].location != NSNotFound ||
                [text rangeOfCharacterFromSet:NSCharacterSet.controlCharacterSet].location != NSNotFound ||
                ![text.lowercaseString hasPrefix:@"https://"] || ![components.scheme.lowercaseString isEqualToString:@"https"] ||
                !components.host.length || !components.URL || [text containsString:@"@"] || components.user || components.password) {
                hz_result_error(result, @"Invalid remote image URL; only https without credentials is allowed.");
                return;
            }
            if (!limit) { hz_result_error(result, @"Remote image byte limit must be positive."); return; }

            fetch = [HZRemoteImageFetch new];
            fetch.limit = limit;
            fetch.data = [NSMutableData data];
            fetch.semaphore = dispatch_semaphore_create(0);
            fetch.started = NSProcessInfo.processInfo.systemUptime;
            fetch.lastActivity = fetch.started;
#ifdef HZ_REMOTE_IMAGE_TESTING
            if (hz_test_exception_stage == 1) [NSException raise:@"HZFixtureException" format:@"Before session creation"];
#endif

            NSURLSessionConfiguration *config = NSURLSessionConfiguration.ephemeralSessionConfiguration;
            config.URLCache = nil;
            config.HTTPCookieStorage = nil;
            config.URLCredentialStorage = nil;
            config.HTTPShouldSetCookies = NO;
            config.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
            config.timeoutIntervalForRequest = hz_idle_timeout;
            config.timeoutIntervalForResource = hz_global_timeout;
#ifdef HZ_REMOTE_IMAGE_TESTING
            // Foundation rounds very short request timeouts on some macOS builds.
            // Keep injected-protocol tests deterministic; the bridge watchdog still
            // exercises the shortened header/idle/global contracts below.
            config.timeoutIntervalForRequest = MAX(1.0, hz_idle_timeout);
            if (hz_test_protocol_class) config.protocolClasses = @[hz_test_protocol_class];
            hz_test_last_configuration = [config copy];
#endif
            NSOperationQueue *queue = [NSOperationQueue new];
            queue.maxConcurrentOperationCount = 1;
            queue.name = @"Hazakura remote image response";
            fetch.session = [NSURLSession sessionWithConfiguration:config delegate:fetch delegateQueue:queue];
            NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:components.URL];
            request.HTTPShouldHandleCookies = NO;
            [request setValue:@"HazakuraEditor/1.13 (local preview image fetch)" forHTTPHeaderField:@"User-Agent"];
            [request setValue:@"image/png,image/jpeg,image/gif,image/webp,image/*;q=0.8" forHTTPHeaderField:@"Accept"];

            fetch.watchdog = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0));
            __weak HZRemoteImageFetch *weakFetch = fetch;
            dispatch_source_set_event_handler(fetch.watchdog, ^{ [weakFetch checkDeadline]; });
            uint64_t interval = (uint64_t)(MIN(0.1, MIN(hz_header_timeout, hz_idle_timeout) / 4.0) * NSEC_PER_SEC);
            dispatch_source_set_timer(fetch.watchdog, dispatch_time(DISPATCH_TIME_NOW, (int64_t)interval), interval, 0);
            dispatch_resume(fetch.watchdog);
            [[fetch.session dataTaskWithRequest:request] resume];
#ifdef HZ_REMOTE_IMAGE_TESTING
            if (hz_test_exception_stage == 2) [NSException raise:@"HZFixtureException" format:@"After request starts"];
#endif
            long wait = dispatch_semaphore_wait(fetch.semaphore,
                dispatch_time(DISPATCH_TIME_NOW, (int64_t)(hz_global_timeout * NSEC_PER_SEC)));
            if (wait) [fetch finish:@"Remote image fetch exceeded the total timeout."];
            [fetch.session invalidateAndCancel];

            @synchronized(fetch) {
                result->status = fetch.status <= UINT16_MAX ? (uint16_t)fetch.status : 0;
                result->content_type = hz_copy_string(fetch.contentType ?: @"");
                result->final_url = hz_copy_string(fetch.finalURL ?: text);
                if (fetch.error) result->error = hz_copy_string(fetch.error);
                else if (fetch.data.length) {
                    result->bytes = malloc(fetch.data.length);
                    if (result->bytes) {
                        result->length = fetch.data.length;
                        memcpy(result->bytes, fetch.data.bytes, result->length);
                    }
                }
                if (!result->content_type || !result->final_url ||
                    (fetch.error && !result->error) || (!fetch.error && fetch.data.length && !result->bytes)) {
                    hz_remote_image_result_free(result);
                    hz_result_error(result, @"Cannot allocate remote image result.");
                }
                fetch.session = nil;
            }
        } @catch (NSException *exception) {
            (void)exception;
            @synchronized(fetch) {
                // Freeze before cancellation, so callbacks cannot change a
                // failed state after the C result has returned to Rust.
                fetch.completed = YES;
            }
            hz_remote_image_result_free(result);
            // Avoid any further Foundation allocation in the exception path.
            result->error = strdup("Remote image fetch failed in the native transport.");
        } @finally {
            // Cleanup also runs for early return and native exceptions. Keep
            // even a cleanup exception inside this C boundary.
            @try {
                if (fetch.watchdog) dispatch_source_cancel(fetch.watchdog);
                [fetch.session invalidateAndCancel];
                fetch.session = nil;
            } @catch (NSException *exception) {
                (void)exception;
            }
        }
    }
}
