import { CoreModule } from '@angular-cms/core';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faDesktop, faExternalLinkAlt, faFileExport, faList, faSave } from '@fortawesome/free-solid-svg-icons';
import { AngularSplitModule } from 'angular-split';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { PropertiesModule } from '../properties/properties.module';
import { ContentCreateComponent } from './content-create/content-create.component';
import { ContentCrudServiceResolver } from './content-crud.service';
import { ContentUpdateComponent } from './content-update/content-update.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        FontAwesomeModule,

        AngularSplitModule,
        ButtonsModule,
        TabsModule,

        CoreModule,
        PropertiesModule,
    ],
    declarations: [
        ContentUpdateComponent,
        ContentCreateComponent
    ],
    exports: [
        ContentUpdateComponent,
        ContentCreateComponent
    ]
})
export class ContentModule {
    constructor(library: FaIconLibrary) {
        library.addIcons(faList, faDesktop, faSave, faFileExport, faExternalLinkAlt);
    }

    static forRoot(): ModuleWithProviders<ContentModule> {
        return {
            ngModule: ContentModule,
            providers: [ContentCrudServiceResolver]
        };
    }
}
