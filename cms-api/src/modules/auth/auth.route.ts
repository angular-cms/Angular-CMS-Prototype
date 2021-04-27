import 'reflect-metadata';
import { Router } from 'express';
import { Injectable } from 'injection-js';

import { asyncRouterErrorHandler } from '../../error';
import { validate } from '../../validation/validate.middleware';
import { createUser } from '../user/user.validation';
import { AuthController } from './auth.controller';
import * as authValidation from './auth.validation';

@Injectable()
export class AuthRouter {
    constructor(private authController: AuthController) { }

    get router(): Router {
        const authRouter: Router = asyncRouterErrorHandler(Router());

        authRouter.get('/can-setup-admin', this.authController.canSetupAdmin);
        authRouter.post('/setup-admin', validate(createUser), this.authController.setupAdminSite);
        authRouter.post('/register', validate(createUser), this.authController.register);
        authRouter.post('/login', validate(authValidation.login), this.authController.login);
        authRouter.post('/refresh-token', this.authController.refreshTokens);
        authRouter.post('/revoke-token', this.authController.revokeToken);
        authRouter.post('/forgot-password', validate(authValidation.forgotPassword), this.authController.forgotPassword);
        authRouter.post('/reset-password', validate(authValidation.resetPassword), this.authController.resetPassword);
        return authRouter
    }
}
