import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NgxWigModule } from 'ngx-wig';
import { PROPERTY_FACTORIES } from '@typijs/core';
import { CmsPortalModule } from '@typijs/portal';

import { CustomModule } from './lazy/custom.module';
import { NgxWigPropertyFactory } from './xhtml/wig.factory';
import { NgxWigProperty } from './xhtml/wig.property';


@NgModule({
    imports: [
        ReactiveFormsModule,
        NgxWigModule,
        // Extend Admin, Editor UI
        CustomModule.forRoot(),
        CmsPortalModule.forRoot()
    ],
    declarations: [
        NgxWigProperty
    ],
    providers: [
        // Override the default xhtml property, using the ngx-wig instead of ngx-quill
        { provide: PROPERTY_FACTORIES, useClass: NgxWigPropertyFactory, multi: true }
    ]
})
export class PortalModule { }
