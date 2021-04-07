import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ConfigService } from '../config/config.service';
import { BrowserLocationService } from '../browser/browser-location.service';
import { ADMIN_ROUTE } from '../injection-tokens';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(
        private router: Router,
        private authService: AuthService,
        private configService: ConfigService,
        private locationService: BrowserLocationService,
        @Inject(ADMIN_ROUTE) private adminPath: string) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const authRequest = this.setAuthorizationHeader(request);
        return next.handle(authRequest).pipe(catchError((error: HttpErrorResponse) => this.handleAuthError(error)));
    }

    private setAuthorizationHeader(request: HttpRequest<any>): HttpRequest<any> {
        // add auth header with jwt if user is logged in and request is to the api url
        const isApiUrl = request.url.startsWith(this.configService.baseApiUrl);
        if (this.authService.isLoggedIn && isApiUrl) {
            return request.clone({ setHeaders: { Authorization: `Bearer ${this.authService.authStatus.token}` } });
        }
        return request;
    }

    private handleAuthError(error: HttpErrorResponse): Observable<any> {
        // handle your auth error or rethrow
        if (error.status === 401 && this.authService.isLoggedIn) {
            // auto logout if 401 or 403 response returned from api
            this.authService.logout();

            const loginUrl = `${this.adminPath}/login?returnUrl=${this.router.routerState.snapshot.url}`;
            this.locationService.navigate(loginUrl);

            // this.router.navigate([`${this.adminPath}/login`], {
            //     queryParams: { returnUrl: this.router.routerState.snapshot.url }
            // }).then(() => {
            //     window.location.reload();
            // });

            // if you've caught / handled the error
            // you don't want to rethrow it unless you also want downstream consumers to have to handle it as well.
            // return of(error.message); // or EMPTY may be appropriate here
        }
        return throwError(error);
    }
}
